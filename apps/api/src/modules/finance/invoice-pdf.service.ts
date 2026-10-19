import { Injectable } from "@nestjs/common";
import { ErrorCode } from "@murafaa/contracts";
import { clients, invoiceItems, invoices } from "@murafaa/database";
import { formatHijri, resolveBranding, taxInvoiceHtml } from "@murafaa/documents";
import { formatSar, t } from "@murafaa/i18n";
import { zatcaQrPayload } from "@murafaa/rules";
import { asc, and, eq, isNull } from "drizzle-orm";
import { writeAudit } from "../../common/audit/audit.js";
import { type PortalMeta, portalAudit } from "../../common/audit/portal-audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import { PdfClient } from "../../common/pdf/pdf.client.js";
import type { PortalPrincipal, Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import type { Meta } from "../cases/case-access.service.js";
import { OfficesService } from "../offices/offices.service.js";

/**
 * The printable tax invoice (ZATCA phase 1): the office's VAT number and the
 * TLV QR on an A4 page, rendered by the PDF service. A buyer with a VAT
 * number gets a tax invoice, anyone else a simplified one. Without the
 * office's VAT number there is no valid tax invoice, so none is printed.
 */
@Injectable()
export class InvoicePdfService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly offices: OfficesService,
    private readonly pdf: PdfClient,
  ) {}

  async render(p: Principal, id: string, meta: Meta) {
    const file = await this.build(id);
    await this.tenantDb.run((tx) =>
      writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "invoice.pdf",
        entity: "invoices",
        entityId: id,
        ...meta,
      }),
    );
    return file;
  }

  /** بوابة العميل: the same invoice, only when it was issued to this client (404 otherwise). */
  async clientRender(who: PortalPrincipal, id: string, meta: PortalMeta) {
    const file = await this.build(id, who.subjectId);
    await this.tenantDb.run((tx) =>
      portalAudit(tx, who, meta, {
        action: "portal.invoice.pdf",
        entity: "invoices",
        entityId: id,
      }),
    );
    return file;
  }

  private async build(id: string, clientId?: string) {
    const tax = await this.offices.taxProfile();
    if (!tax.vatNumber)
      throw new ApiException(ErrorCode.CONFLICT, undefined, "errors.TAX_PROFILE_MISSING");
    const branding = resolveBranding(await this.offices.branding());
    const { inv, buyer, items } = await this.tenantDb.run(async (tx) => {
      const [row] = await tx
        .select({ inv: invoices, buyerName: clients.name, buyerVat: clients.vatNumber })
        .from(invoices)
        .innerJoin(clients, eq(clients.id, invoices.clientId))
        .where(
          and(
            eq(invoices.id, id),
            isNull(invoices.deletedAt),
            clientId ? eq(invoices.clientId, clientId) : undefined,
          ),
        );
      if (!row) throw new ApiException(ErrorCode.NOT_FOUND);
      const lines = await tx
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, id))
        .orderBy(asc(invoiceItems.sortOrder));
      return {
        inv: row.inv,
        buyer: { name: row.buyerName, vatNumber: row.buyerVat },
        items: lines,
      };
    });
    const html = taxInvoiceHtml({
      branding,
      labels: {
        title: t(buyer.vatNumber ? "invoicePdf.titleStandard" : "invoicePdf.titleSimplified"),
        number: t("invoicePdf.number"),
        issueDate: t("invoicePdf.issueDate"),
        seller: t("invoicePdf.seller"),
        buyer: t("invoicePdf.buyer"),
        vatNumber: t("invoicePdf.vatNumber"),
        crNumber: t("invoicePdf.crNumber"),
        address: t("invoicePdf.address"),
        description: t("invoicePdf.description"),
        quantity: t("invoicePdf.quantity"),
        unitPrice: t("invoicePdf.unitPrice"),
        lineNet: t("invoicePdf.lineNet"),
        net: t("invoicePdf.net"),
        vat: t("invoicePdf.vat"),
        total: t("invoicePdf.total"),
        qrNote: t("invoicePdf.qrNote"),
      },
      invoice: {
        number: inv.number,
        issueDate: `${inv.issueDate.toISOString().slice(0, 10)} — ${formatHijri(inv.issueDate)}`,
        seller: {
          name: branding.name,
          vatNumber: tax.vatNumber,
          crNumber: tax.crNumber,
          address: tax.taxAddress,
        },
        buyer,
        items: items.map((i) => ({
          description: i.description,
          quantity: i.quantity.toLocaleString("ar-SA"),
          unitPrice: formatSar(i.unitPrice),
          lineNet: formatSar(i.lineNet),
        })),
        net: formatSar(inv.netAmount),
        vat: formatSar(inv.vatAmount),
        total: formatSar(inv.totalAmount),
        // The moment the invoice was issued in the system, as ZATCA asks.
        qrPayload: zatcaQrPayload({
          sellerName: branding.name,
          vatNumber: tax.vatNumber,
          timestamp: inv.createdAt,
          total: inv.totalAmount,
          vat: inv.vatAmount,
        }),
      },
    });
    const bytes = await this.pdf.render(html);
    return { bytes, fileName: `${inv.number}.pdf` };
  }
}
