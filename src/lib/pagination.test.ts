import { describe, expect, it } from "vitest";
import { normalizePagination } from "@/lib/pagination";

describe("normalizePagination", () => {
  it("aplica valores por defecto y un rango determinista", () => {
    expect(normalizePagination(undefined, undefined, { defaultPageSize: 10, maxPageSize: 25 })).toEqual({ page: 1, pageSize: 10, from: 0, to: 9 });
  });

  it("limita pageSize y evita páginas negativas", () => {
    expect(normalizePagination(-3, 500, { defaultPageSize: 10, maxPageSize: 25 })).toEqual({ page: 1, pageSize: 25, from: 0, to: 24 });
  });

  it("calcula la ventana de una página posterior", () => {
    expect(normalizePagination(3, 5, { defaultPageSize: 10, maxPageSize: 25 })).toEqual({ page: 3, pageSize: 5, from: 10, to: 14 });
  });
});
