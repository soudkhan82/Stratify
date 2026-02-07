"use client";


import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type ProductRow = {
  item_code: string;
  item: string;
  avg_qty: number | null; // already aggregated by API
  unit: string | null;
};

function fmtNum(v: number | null) {
  if (v === null || !Number.isFinite(v)) return "—";
  // compact but readable
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
    v,
  );
}

export function ProductTableCard({
  rows,
  selectedItemCode,
  onSelect,
  height = 340,
}: {
  rows: ProductRow[];
  selectedItemCode: string | null;
  onSelect: (row: ProductRow) => void;
  height?: number;
}) {
  return (
    <Card className="border-white/10 bg-white/70 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          Products (sorted by Avg Qty)
        </CardTitle>
        <div className="text-xs text-muted-foreground">
          Click a row to load the trend chart with correct units.
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <ScrollArea style={{ height }}>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b">
                <TableRow>
                  <TableHead className="w-[55%]">Product</TableHead>
                  <TableHead className="w-[25%] text-right">Avg Qty</TableHead>
                  <TableHead className="w-[20%]">Unit</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      No products returned for current dataset/element.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => {
                    const active = selectedItemCode === r.item_code;
                    return (
                      <TableRow
                        key={r.item_code}
                        onClick={() => onSelect(r)}
                        className={cn(
                          "cursor-pointer",
                          active && "bg-blue-50 hover:bg-blue-50",
                        )}
                      >
                        <TableCell className="font-medium">{r.item}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtNum(r.avg_qty)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.unit ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
