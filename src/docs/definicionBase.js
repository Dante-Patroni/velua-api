/**
 * @description Definicion base del contrato OpenAPI: info, servers, tags y
 * componentes reutilizables. Los `paths` NO viven aca: salen de los comentarios
 * `@openapi` de los archivos de rutas.
 *
 * Este archivo es la fuente de verdad de los esquemas. `docs/openapi.json` se
 * genera a partir de aca con `npm run openapi` y no se edita a mano.
 */
module.exports = {
  openapi: "3.0.3",
  info: {
    title: "API Velua",
    version: "1.0.0",
    description:
      'API de la tienda online de Velua, cosmetica natural artesanal.\n\nLos endpoints del catalogo son publicos. Los de administracion requieren sesion.\n\n**Convenciones**\n\n- Los importes viajan como cadena decimal ("12500.00"), nunca como numero. El frontend los formatea, no opera con ellos.\n- Los errores siguen el contrato `{ "error": "CODIGO_DOMINIO" }`. El texto legible lo arma el frontend a partir del codigo.\n- El listado de productos es liviano y la ficha es completa. Son dos endpoints con dos propositos distintos.',
  },
  servers: [
    {
      url: "http://localhost:3000/api/v1",
      description: "Desarrollo",
    },
    {
      url: "https://api.velua.com.ar/api/v1",
      description: "Produccion",
    },
  ],
  tags: [
    {
      name: "Catalogo",
      description: "Lectura publica de categorias y productos",
    },
    {
      name: "Sistema",
      description: "Estado del servicio",
    },
  ],
  components: {
    parameters: {
      Pagina: {
        name: "pagina",
        in: "query",
        description: "Numero de pagina, empezando en 1.",
        required: false,
        schema: {
          type: "integer",
          minimum: 1,
          default: 1,
        },
      },
      Limite: {
        name: "limite",
        in: "query",
        description: "Cantidad de elementos por pagina.",
        required: false,
        schema: {
          type: "integer",
          minimum: 1,
          maximum: 50,
          default: 20,
        },
      },
    },
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "velua_sesion",
      },
    },
    schemas: {
      Salud: {
        type: "object",
        properties: {
          estado: {
            type: "string",
            example: "ok",
          },
          version: {
            type: "string",
            example: "1.0.0",
          },
          entorno: {
            type: "string",
            example: "development",
          },
          baseDatos: {
            type: "string",
            enum: ["conectada", "desconectada"],
          },
        },
        required: ["estado", "version", "entorno", "baseDatos"],
      },
      Error: {
        type: "object",
        description:
          "Contrato unico de error. El frontend mapea el codigo a un texto legible segun el contexto donde aparece.",
        properties: {
          error: {
            type: "string",
            description: "Codigo de dominio estable.",
            example: "NO_ENCONTRADO",
          },
          details: {
            type: "object",
            description: "Solo en DATOS_INVALIDOS. Un mensaje por campo con error.",
            additionalProperties: {
              type: "string",
            },
          },
        },
        required: ["error"],
      },
      Meta: {
        type: "object",
        properties: {
          pagina: {
            type: "integer",
            example: 1,
          },
          limite: {
            type: "integer",
            example: 20,
          },
          total: {
            type: "integer",
            description: "Total de elementos que cumplen el filtro, no de la pagina.",
            example: 47,
          },
        },
        required: ["pagina", "limite", "total"],
      },
      Categoria: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            example: 3,
          },
          nombre: {
            type: "string",
            example: "Jabones",
          },
          slug: {
            type: "string",
            example: "jabones",
          },
          descripcion: {
            type: "string",
            nullable: true,
            example: "Jabones artesanales en frio",
          },
          imagenUrl: {
            type: "string",
            nullable: true,
            format: "uri",
          },
        },
        required: ["id", "nombre", "slug"],
      },
      Imagen: {
        type: "object",
        properties: {
          url: {
            type: "string",
            format: "uri",
          },
          alt: {
            type: "string",
            nullable: true,
          },
        },
        required: ["url"],
      },
      Variante: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            example: 12,
          },
          nombre: {
            type: "string",
            description: "Tamano o presentacion.",
            example: "100 g",
          },
          sku: {
            type: "string",
            nullable: true,
            example: "JAB-CAL-100",
          },
          precio: {
            type: "string",
            description: "Cadena decimal. No operar en el frontend.",
            example: "12500.00",
          },
          precioAnterior: {
            type: "string",
            nullable: true,
            description:
              "Precio tachado. El badge de oferta se muestra SOLO si existe y es mayor que precio.",
            example: "15000.00",
          },
          hayStock: {
            type: "boolean",
            description: "Si la variante tiene unidades disponibles.",
          },
        },
        required: ["id", "nombre", "precio", "hayStock"],
      },
      ProductoListado: {
        type: "object",
        description:
          "Version liviana para la grilla. No trae variantes ni el resto de las imagenes.",
        properties: {
          id: {
            type: "integer",
            example: 7,
          },
          nombre: {
            type: "string",
            example: "Jabon Vegetal - Calendula y Karite",
          },
          slug: {
            type: "string",
            example: "jabon-calendula-karite",
          },
          descripcionCorta: {
            type: "string",
            nullable: true,
          },
          categoria: {
            $ref: "#/components/schemas/Categoria",
          },
          imagen: {
            allOf: [
              {
                $ref: "#/components/schemas/Imagen",
              },
            ],
            nullable: true,
            description:
              "Imagen principal, la de orden 0. Null si el producto todavia no tiene fotos.",
          },
          precioDesde: {
            type: "string",
            description: "Precio minimo entre las variantes activas.",
            example: "12500.00",
          },
          precioAnteriorDesde: {
            type: "string",
            nullable: true,
            description: "Precio anterior de la variante mas barata, si esta en oferta.",
          },
          hayStock: {
            type: "boolean",
            description: "True si al menos una variante activa tiene stock.",
          },
          destacado: {
            type: "boolean",
          },
        },
        required: ["id", "nombre", "slug", "categoria", "precioDesde", "hayStock", "destacado"],
      },
      ProductoDetalle: {
        type: "object",
        description: "Ficha completa del producto.",
        properties: {
          id: {
            type: "integer",
            example: 7,
          },
          nombre: {
            type: "string",
            example: "Jabon Vegetal - Calendula y Karite",
          },
          slug: {
            type: "string",
            example: "jabon-calendula-karite",
          },
          descripcionCorta: {
            type: "string",
            nullable: true,
          },
          descripcion: {
            type: "string",
            nullable: true,
          },
          ingredientes: {
            type: "string",
            nullable: true,
            description: "Listado tal como va en la etiqueta.",
          },
          modoUso: {
            type: "string",
            nullable: true,
          },
          destacado: {
            type: "boolean",
          },
          categoria: {
            $ref: "#/components/schemas/Categoria",
          },
          imagenes: {
            type: "array",
            description: "Todas las imagenes, ordenadas. La primera es la principal.",
            items: {
              $ref: "#/components/schemas/Imagen",
            },
          },
          variantes: {
            type: "array",
            description: "Variantes activas. Siempre hay al menos una.",
            items: {
              $ref: "#/components/schemas/Variante",
            },
            minItems: 1,
          },
        },
        required: ["id", "nombre", "slug", "categoria", "imagenes", "variantes", "destacado"],
      },
    },
  },
};
