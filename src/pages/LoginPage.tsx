import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useLoginMutation } from '@/features/auth/authApi';
import { useAppSelector } from '@/store/hooks';
import { apiErrorMessage } from '@/lib/apiError';
import { copyrightLine } from '@/lib/company';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// The pharmacy code is not a secret — remembering it spares the cashier retyping it.
const TENANT_KEY = 'medipos.lastTenantId';

// tenantId is the pharmacy's login code (e.g. "MP-4K7TQ2"); the server also
// accepts a legacy 24-char ObjectId, so saved values keep working.
const loginSchema = z.object({
  tenantId: z.string().trim().min(3, 'Enter your pharmacy code'),
  phone: z.string().min(3, 'Enter your phone number'),
  password: z.string().min(1, 'Enter your password'),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const [login, { isLoading }] = useLoginMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      tenantId: localStorage.getItem(TENANT_KEY) ?? '',
      phone: '',
      password: '',
    },
  });

  // If a session already exists (e.g. boot refresh succeeded), skip the form.
  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const onSubmit = async (values: LoginValues) => {
    try {
      await login(values).unwrap();
      localStorage.setItem(TENANT_KEY, values.tenantId);
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Login failed'));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">MediPOS</CardTitle>
            <CardDescription>Counter terminal sign-in</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="tenantId">Pharmacy Code</Label>
                <Input
                  id="tenantId"
                  placeholder="e.g. MP-4K7TQ2"
                  autoComplete="off"
                  aria-invalid={!!errors.tenantId}
                  {...register('tenantId')}
                />
                {errors.tenantId && (
                  <p className="text-xs text-destructive">{errors.tenantId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  autoComplete="username"
                  aria-invalid={!!errors.phone}
                  {...register('phone')}
                />
                {errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="size-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground/70">{copyrightLine()}</p>
      </motion.div>
    </div>
  );
}
