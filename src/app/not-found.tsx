import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-8 pb-8 space-y-4">
          <FileQuestion className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-bold">Página não encontrada</h1>
          <p className="text-sm text-muted-foreground">
            A página que você procura não existe ou foi movida.
          </p>
          <Button asChild className="mt-4">
            <Link href="/dashboard">Voltar ao dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
