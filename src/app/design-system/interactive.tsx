'use client';

import * as React from 'react';
import { Button, ConfirmDialog, ToastProvider, useToast } from '@/components/ui';

/**
 * The two components that only exist once you interact with them.
 * Split out as a client island so the rest of the showcase stays a Server
 * Component.
 */

function ToastTriggers() {
  const { show } = useToast();
  return (
    <div className="flex flex-wrap gap-3">
      <Button size="sm" onClick={() => show('تم حفظ التغييرات', 'success')}>
        toast · success
      </Button>
      <Button size="sm" variant="secondary" onClick={() => show('جارٍ المزامنة مع ناجز', 'info')}>
        toast · info
      </Button>
      <Button size="sm" variant="danger" onClick={() => show('تعذّر رفع المستند', 'error')}>
        toast · error
      </Button>
    </div>
  );
}

export function InteractiveDemos() {
  const [open, setOpen] = React.useState(false);

  return (
    <ToastProvider regionLabel="التنبيهات" dismissLabel="إغلاق">
      <div className="flex flex-col gap-6">
        <ToastTriggers />
        <div>
          <Button variant="danger" onClick={() => setOpen(true)}>
            confirm dialog · danger
          </Button>
          <ConfirmDialog
            open={open}
            tone="danger"
            title="إغلاق القضية؟"
            description="سيتم أرشفة القضية ولن يمكن تعديلها بعد الإغلاق."
            confirmLabel="تأكيد الإغلاق"
            cancelLabel="إلغاء"
            onConfirm={async () => {
              await new Promise((resolve) => setTimeout(resolve, 700));
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        </div>
      </div>
    </ToastProvider>
  );
}
