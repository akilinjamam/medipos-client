import { Paperclip, Pill, Stethoscope } from 'lucide-react';
import { useGetCustomerPrescriptionsQuery } from '@/features/customers/customersApi';
import { apiErrorMessage } from '@/lib/apiError';
import { formatDate } from '@/lib/datetime';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface PrescriptionHistoryProps {
  open: boolean;
  customerId: string;
  customerName: string;
  onClose: () => void;
}

/**
 * Read-only prescription history for the attached customer (Platinum — the
 * server gates `GET /customers/:id/prescriptions` behind `prescriptionHistory`).
 * Quick reference at the counter; entries are managed from the dashboard.
 */
export function PrescriptionHistory({
  open,
  customerId,
  customerName,
  onClose,
}: PrescriptionHistoryProps) {
  const { data, isFetching, isError, error } = useGetCustomerPrescriptionsQuery(customerId, {
    skip: !open,
  });

  const entries = data?.prescriptions ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Prescription history"
      description={customerName}
    >
      {isFetching ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="py-6 text-center text-sm text-destructive">{apiErrorMessage(error)}</p>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
          <Pill className="size-6" />
          <p className="text-sm">No prescriptions recorded for this customer.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {entries
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((p, i) => (
              <div key={`${p.date}-${i}`} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{formatDate(p.date)}</span>
                  {p.fileKey && (
                    <Badge variant="secondary">
                      <Paperclip className="size-3" />
                      Attachment
                    </Badge>
                  )}
                </div>
                {p.doctorName && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Stethoscope className="size-3.5" />
                    {p.doctorName}
                  </div>
                )}
                {p.notes && <p className="mt-1 text-sm">{p.notes}</p>}
              </div>
            ))}
        </div>
      )}
    </Modal>
  );
}
