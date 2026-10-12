const crypto = require("crypto");
const { firmaValida, armarManifiesto } = require("../../src/pagos/firmaMercadoPago");

const SECRETO = "clave-de-prueba";
const AVISO = { dataId: "123456", requestId: "req-1", ts: "1728570000" };

/** Firma como lo haría Mercado Pago. */
const firmar = ({ dataId, requestId, ts }, secreto = SECRETO) => {
  const v1 = crypto
    .createHmac("sha256", secreto)
    .update(`id:${dataId};request-id:${requestId};ts:${ts};`)
    .digest("hex");
  return `ts=${ts},v1=${v1}`;
};

const verificar = (cambios = {}) =>
  firmaValida({
    encabezadoFirma: firmar(AVISO),
    requestId: AVISO.requestId,
    dataId: AVISO.dataId,
    secreto: SECRETO,
    ...cambios,
  });

describe("armarManifiesto", () => {
  it("arma el texto en el orden de Mercado Pago", () => {
    expect(armarManifiesto(AVISO)).toBe("id:123456;request-id:req-1;ts:1728570000;");
  });

  it("omite las partes que faltan", () => {
    expect(armarManifiesto({ ts: "1" })).toBe("ts:1;");
  });
});

describe("firmaValida", () => {
  it("acepta un aviso firmado con la clave correcta", () => {
    expect(verificar()).toBe(true);
  });

  it("rechaza si la clave es otra", () => {
    expect(verificar({ encabezadoFirma: firmar(AVISO, "otra-clave") })).toBe(false);
  });

  it("rechaza si cambiaron el id del pago", () => {
    expect(verificar({ dataId: "999999" })).toBe(false);
  });

  it("rechaza si cambiaron el request-id", () => {
    expect(verificar({ requestId: "req-2" })).toBe(false);
  });

  it.each([
    ["sin encabezado", undefined],
    ["sin v1", "ts=1728570000"],
    ["con basura", "cualquier-cosa"],
    ["con un v1 que no es hexadecimal", "ts=1728570000,v1=zzzz"],
  ])("rechaza %s", (_caso, encabezadoFirma) => {
    expect(verificar({ encabezadoFirma })).toBe(false);
  });

  it("sin clave configurada no acepta nada", () => {
    expect(verificar({ secreto: "" })).toBe(false);
  });
});
