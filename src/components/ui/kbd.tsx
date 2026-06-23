import { cn } from '@/lib/utils';

/** A small keycap hint, e.g. <Kbd>F8</Kbd>. */
function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-4 min-w-4 items-center justify-center rounded border bg-muted px-1 text-[10px] font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
