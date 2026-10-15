import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, ChevronLeft } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

export default function NotFound() {
  const { isTamil } = useLanguage();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground p-4">
      <Card className="w-full max-w-md border border-border bg-card">
        <CardContent className="pt-6">
          <div className="flex mb-4 items-center gap-3">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-xl font-bold">
              {isTamil ? '404 பக்கம் கிடைக்கவில்லை' : '404 Page Not Found'}
            </h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {isTamil
              ? 'நீங்கள் தேடிய பக்கம் அல்லது முகவரி கிடைக்கவில்லை.'
              : 'The page or route you are looking for does not exist.'}
          </p>
          <div className="mt-6">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <ChevronLeft size={16} />
              {isTamil ? 'முகப்புப் பக்கத்திற்குத் திரும்புக' : 'Return to home'}
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
