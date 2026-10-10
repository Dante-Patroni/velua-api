const crypto = require("crypto");
const WebhookController = require("../../src/controllers/WebhookController");

const SECRETO = "clave-de-prueba";

const armarReq = ({ dataId = "123", tipo = "payment", firma, requestId = "req-1" } = {}) => {
  const ts = "1728570000";
  const v1 = crypto
    .createHmac("sha256", SECRETO)
    .update(`id:${dataId};request-id:${requestId};ts:${ts};`)
    .digest("hex");
  const encabezados = {
    "x-signature": firma === undefined ? `ts=${ts},v1=${v1}` : firma,
    "x-request-id": requestId,
  };
  return {
    query: { "data.id": dataId, type: tipo },
    get: (nombre) => encabezados[nombre.toLowerCase()],
  };
};

const armar = ({ secreto = SECRETO, procesar } = {}) => {
  const servicio = {
    procesarNotificacion: jest.fn(
      procesar ?? (async () => ({ procesado: true, numero: "VEL-ABC234" }))
    ),
  };
  const logger = { info: jest.fn(), error: jest.fn() };
  const controller = new WebhookController(servicio, { secreto, logger });
  const res = { sendStatus: jest.fn() };
  return { controller, servicio, logger, res };
};

describe("WebhookController.mercadoPago", () => {
  it("con firma válida procesa el pago y responde 200", async () => {
    const { controller, servicio, res } = armar();

    await controller.mercadoPago(armarReq(), res);

    expect(servicio.procesarNotificacion).toHaveBeenCalledWith("123");
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  it("con firma inválida responde 401 y no procesa nada", async () => {
    const { controller, servicio, res } = armar();

    await controller.mercadoPago(armarReq({ firma: "ts=1,v1=abcd" }), res);

    expect(res.sendStatus).toHaveBeenCalledWith(401);
    expect(servicio.procesarNotificacion).not.toHaveBeenCalled();
  });

  it("un aviso que no es de pagos responde 200 sin procesar", async () => {
    const { controller, servicio, res } = armar();

    await controller.mercadoPago(armarReq({ tipo: "merchant_order" }), res);

    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(servicio.procesarNotificacion).not.toHaveBeenCalled();
  });

  it("si el servicio falla, responde 500 para que Mercado Pago reintente", async () => {
    const { controller, logger, res } = armar({
      procesar: async () => {
        throw new Error("PROCESADOR_NO_DISPONIBLE");
      },
    });

    await controller.mercadoPago(armarReq(), res);

    expect(res.sendStatus).toHaveBeenCalledWith(500);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("PROCESADOR_NO_DISPONIBLE"),
      ""
    );
  });

  it("sin clave configurada responde 503 y lo anota", async () => {
    const { controller, servicio, logger, res } = armar({ secreto: "" });

    await controller.mercadoPago(armarReq(), res);

    expect(res.sendStatus).toHaveBeenCalledWith(503);
    expect(servicio.procesarNotificacion).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
