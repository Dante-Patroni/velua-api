const { manejarErrorHttp } = require("../../src/middlewares/errorMapper");

/**
 * @description Response falsa que registra el status y el cuerpo.
 * @returns {Object} res con status y json encadenables.
 */
const crearRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

/**
 * @description Error como lo arma el parser de cuerpos de Express: mensaje
 * técnico, status de cliente y un type que identifica el problema.
 * @param {string} mensaje - Mensaje técnico del parser.
 * @param {number} status - Status que propone el parser.
 * @param {string} type - Tipo de error del parser.
 * @param {Object} [extra] - Otros campos que trae el error.
 * @returns {Error} Error con los campos del parser.
 */
const errorDelParser = (mensaje, status, type, extra = {}) =>
  Object.assign(new Error(mensaje), { status, statusCode: status, expose: true, type, ...extra });

describe("errorMapper: errores del parser del cuerpo", () => {
  let consola;

  beforeEach(() => {
    consola = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consola.mockRestore();
  });

  it("un JSON malformado responde 400 JSON_INVALIDO, sin el cuerpo y sin log", () => {
    const res = crearRes();
    const error = errorDelParser("Unexpected token , in JSON at position 27", 400, "entity.parse.failed", {
      body: '{"items":[{"varianteId":,"cantidad":1}]}',
    });

    manejarErrorHttp(error, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "JSON_INVALIDO" });
    expect(consola).not.toHaveBeenCalled();
  });

  it("un cuerpo demasiado grande responde 413 CUERPO_DEMASIADO_GRANDE, sin log", () => {
    const res = crearRes();
    const error = errorDelParser("request entity too large", 413, "entity.too.large", {
      limit: 102400,
      length: 500000,
    });

    manejarErrorHttp(error, res);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ error: "CUERPO_DEMASIADO_GRANDE" });
    expect(consola).not.toHaveBeenCalled();
  });
});