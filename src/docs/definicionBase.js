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
      url: "https://velua-api-production.up.railway.app/api/v1",
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
    {
      name: "Autenticacion",
      description: "Sesion del panel de administracion",
    },
    { name: "Admin - Categorias", description: "Gestion de categorias desde el panel" },
    { name: "Admin - Productos", description: "Gestion de productos y variantes desde el panel" },
    { name: "Admin - Imagenes", description: "Fotos de producto: subida, orden y borrado" },
    { name: "Carrito", description: "Cotizacion del carrito y zonas de envio" },
    { name: "Pedidos", description: "Creacion de pedidos y consulta publica de su estado" },
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
      IdRuta: {
        name: "id",
        in: "path",
        required: true,
        description: "Id del recurso.",
        schema: { type: "integer", minimum: 1 },
      },
      VarianteIdRuta: {
        name: "varianteId",
        in: "path",
        required: true,
        description: "Id de la variante dentro del producto.",
        schema: { type: "integer", minimum: 1 },
      },
      ImagenIdRuta: {
        name: "imagenId",
        in: "path",
        required: true,
        description: "Id de la imagen dentro del producto.",
        schema: { type: "integer", minimum: 1 },
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
          padreId: {
            type: "integer",
            nullable: true,
            example: null,
          },
          hijas: {
            type: "array",
            description:
              "Solo en GET /categorias y solo en las de primer nivel: sus categorías hijas.",
            items: { $ref: "#/components/schemas/Categoria" },
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
          "Imagen principal: la primera segun su orden. Null si el producto todavia no tiene fotos.",
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
      LoginEntrada: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            maxLength: 180,
            example: "duena@veluanature.com.ar",
          },
          password: { type: "string", minLength: 1, maxLength: 128 },
        },
      },
      Usuario: {
        type: "object",
        required: ["id", "nombre", "email", "rol", "permisos"],
        properties: {
          id: { type: "integer", example: 1 },
          nombre: { type: "string", example: "Dueña de la marca" },
          email: { type: "string", format: "email" },
          rol: { type: "string", enum: ["admin", "operador"] },
          permisos: {
            type: "array",
            items: { type: "string" },
            example: ["CATALOGO_VER", "CATALOGO_EDITAR"],
          },
        },
      },
      CategoriaAdmin: {
        type: "object",
        description: "Categoria vista desde el panel. Incluye las inactivas.",
        required: ["id", "nombre", "slug", "orden", "activa", "cantidadProductos"],
        properties: {
          id: { type: "integer", example: 5 },
          nombre: { type: "string", example: "L’Art du Savon" },
          slug: { type: "string", example: "art-du-savon" },
          descripcion: { type: "string", nullable: true },
          imagenUrl: { type: "string", format: "uri", nullable: true },
          padreId: {
            type: "integer",
            nullable: true,
            description: "Categoría padre. Null si es de primer nivel.",
          },
          cantidadHijas: {
            type: "integer",
            description: "Si es mayor que cero, la categoría no puede tener productos.",
            example: 0,
          },
          orden: { type: "integer", example: 2 },
          activa: { type: "boolean" },
          cantidadProductos: {
            type: "integer",
            description:
              "Productos activos de la categoria. Desactivarla los oculta a todos de la tienda.",
            example: 6,
          },
        },
      },
      CategoriaEntrada: {
        type: "object",
        required: ["nombre"],
        properties: {
          nombre: { type: "string", minLength: 1, maxLength: 80, example: "Shampoo Sólido" },
          slug: {
            type: "string",
            maxLength: 80,
            nullable: true,
            description:
              "Opcional. Si no viene se genera del nombre. Si viene y esta tomado, se rechaza.",
          },
          descripcion: { type: "string", maxLength: 300, nullable: true },
          imagenUrl: { type: "string", format: "uri", maxLength: 500, nullable: true },
          padreId: {
            type: "integer",
            nullable: true,
            description:
              "Categoría padre, que tiene que ser de primer nivel y sin productos. Null para el primer nivel.",
          },
        },
      },
      CategoriaCambios: {
        type: "object",
        description:
          "Solo se modifican los campos que vienen. Cambiar el nombre no cambia el slug.",
        properties: {
          nombre: { type: "string", minLength: 1, maxLength: 80 },
          slug: { type: "string", maxLength: 80, nullable: true },
          descripcion: { type: "string", maxLength: 300, nullable: true },
          imagenUrl: { type: "string", format: "uri", maxLength: 500, nullable: true },
          padreId: {
            type: "integer",
            nullable: true,
            description:
              "Categoría padre, que tiene que ser de primer nivel y sin productos. Null para el primer nivel.",
          },
        },
      },
      VarianteAdmin: {
        type: "object",
        description:
          "Variante vista desde el panel. A diferencia de la tienda, expone el stock real.",
        required: ["id", "nombre", "precio", "stock", "activa"],
        properties: {
          id: { type: "integer", example: 10 },
          nombre: { type: "string", example: "100 g" },
          sku: { type: "string", nullable: true, example: "VEL-ECLAT-NOIR" },
          precio: { type: "string", description: "Cadena decimal.", example: "8500.00" },
          precioAnterior: { type: "string", nullable: true, example: "9900.00" },
          stock: { type: "integer", example: 12 },
          pesoGramos: { type: "integer", nullable: true, example: 100 },
          activa: { type: "boolean" },
        },
      },
      ImagenAdmin: {
        type: "object",
        required: ["id", "url", "orden"],
        properties: {
          id: { type: "integer", example: 3 },
          url: { type: "string", format: "uri" },
          alt: { type: "string", nullable: true },
          orden: { type: "integer", example: 0 },
        },
      },
      ProductoAdminFila: {
        type: "object",
        description: "Fila de la grilla del panel, con los totales resumidos.",
        required: [
          "id",
          "nombre",
          "slug",
          "activo",
          "destacado",
          "cantidadVariantes",
          "stockTotal",
          "cantidadImagenes",
        ],
        properties: {
          id: { type: "integer", example: 7 },
          nombre: { type: "string", example: "Éclat Noir" },
          slug: { type: "string", example: "eclat-noir" },
          descripcionCorta: { type: "string", nullable: true },
          activo: { type: "boolean" },
          destacado: { type: "boolean" },
          categoria: { $ref: "#/components/schemas/Categoria" },
          cantidadVariantes: { type: "integer", description: "Variantes activas.", example: 2 },
          precioDesde: { type: "string", nullable: true, example: "8500.00" },
          stockTotal: {
            type: "integer",
            description: "Suma del stock de las variantes activas.",
            example: 20,
          },
          cantidadImagenes: { type: "integer", example: 3 },
        },
      },
      ProductoAdmin: {
        type: "object",
        description: "Ficha completa del producto en el panel, con todas sus variantes e imagenes.",
        required: ["id", "nombre", "slug", "activo", "destacado", "variantes", "imagenes"],
        properties: {
          id: { type: "integer", example: 7 },
          nombre: { type: "string" },
          slug: { type: "string" },
          descripcionCorta: { type: "string", nullable: true },
          descripcion: { type: "string", nullable: true },
          ingredientes: { type: "string", nullable: true },
          modoUso: { type: "string", nullable: true },
          activo: { type: "boolean" },
          destacado: { type: "boolean" },
          categoria: { $ref: "#/components/schemas/Categoria" },
          variantes: {
            type: "array",
            description: "Todas, activas e inactivas.",
            items: { $ref: "#/components/schemas/VarianteAdmin" },
          },
          imagenes: {
            type: "array",
            items: { $ref: "#/components/schemas/ImagenAdmin" },
          },
        },
      },
      VarianteEntrada: {
        type: "object",
        required: ["nombre", "precio"],
        properties: {
          nombre: { type: "string", maxLength: 80, example: "100 g" },
          sku: { type: "string", maxLength: 60, nullable: true },
          precio: {
            oneOf: [{ type: "string" }, { type: "number" }],
            description: "Se acepta con punto o coma. Se guarda con dos decimales.",
            example: "8500",
          },
          precioAnterior: {
            oneOf: [{ type: "string" }, { type: "number" }],
            nullable: true,
            description:
              "Tiene que ser MAYOR que precio. Si fuera igual o menor, la oferta seria de cero por ciento.",
            example: "9900",
          },
          stock: { type: "integer", minimum: 0, default: 0 },
          pesoGramos: { type: "integer", minimum: 0, nullable: true },
        },
      },
      VarianteCambios: {
        type: "object",
        description: "Solo se modifican los campos que vienen.",
        properties: {
          nombre: { type: "string", maxLength: 80 },
          sku: { type: "string", maxLength: 60, nullable: true },
          precio: { oneOf: [{ type: "string" }, { type: "number" }] },
          precioAnterior: {
            oneOf: [{ type: "string" }, { type: "number" }],
            nullable: true,
            description: "En null quita la oferta.",
          },
          stock: { type: "integer", minimum: 0 },
          pesoGramos: { type: "integer", minimum: 0, nullable: true },
        },
      },
      ProductoEntrada: {
        type: "object",
        required: ["categoriaId", "nombre", "variantes"],
        properties: {
          categoriaId: { type: "integer", minimum: 1 },
          nombre: { type: "string", minLength: 1, maxLength: 140 },
          slug: {
            type: "string",
            maxLength: 160,
            nullable: true,
            description:
              "Opcional. Si no viene se genera del nombre. Si viene y esta tomado, se rechaza.",
          },
          descripcionCorta: { type: "string", maxLength: 300, nullable: true },
          descripcion: { type: "string", nullable: true },
          ingredientes: { type: "string", nullable: true },
          modoUso: { type: "string", nullable: true },
          destacado: { type: "boolean", default: false },
          variantes: {
            type: "array",
            minItems: 1,
            description: "Al menos una. El esquema no admite productos sin variantes.",
            items: { $ref: "#/components/schemas/VarianteEntrada" },
          },
        },
      },
      ProductoCambios: {
        type: "object",
        description: "Solo se modifican los campos que vienen. No toca las variantes.",
        properties: {
          categoriaId: { type: "integer", minimum: 1 },
          nombre: { type: "string", minLength: 1, maxLength: 140 },
          slug: { type: "string", maxLength: 160, nullable: true },
          descripcionCorta: { type: "string", maxLength: 300, nullable: true },
          descripcion: { type: "string", nullable: true },
          ingredientes: { type: "string", nullable: true },
          modoUso: { type: "string", nullable: true },
          destacado: { type: "boolean" },
        },
      },

      ZonaEnvio: {
        type: "object",
        required: ["id", "nombre", "costo"],
        properties: {
          id: { type: "integer", example: 2 },
          nombre: { type: "string", example: "Provincia de Córdoba" },
          costo: { type: "string", description: "Cadena decimal.", example: "6500.00" },
          demora: { type: "string", nullable: true, example: "2 a 4 días hábiles" },
        },
      },
      CotizacionEntrada: {
        type: "object",
        required: ["items"],
        properties: {
          items: {
            type: "array",
            minItems: 1,
            maxItems: 30,
            description: "El carrito. Solo que y cuanto: los precios los pone el servidor.",
            items: {
              type: "object",
              required: ["varianteId", "cantidad"],
              properties: {
                varianteId: { type: "integer", minimum: 1 },
                cantidad: { type: "integer", minimum: 1, example: 2 },
              },
            },
          },
          zonaEnvioId: {
            type: "integer",
            nullable: true,
            description: "Sin zona, se cotiza como retiro en persona y el envio es cero.",
          },
          medioPago: {
            type: "string",
            nullable: true,
            enum: ["transferencia", "mercadopago"],
            description: "El descuento por transferencia se aplica solo con ese medio.",
          },
        },
      },
      ItemCotizado: {
        type: "object",
        required: ["varianteId", "cantidad", "precioUnitario", "subtotal"],
        properties: {
          varianteId: { type: "integer" },
          productoNombre: { type: "string", example: "Éclat Noir" },
          productoSlug: { type: "string", nullable: true, example: "eclat-noir" },
          varianteNombre: { type: "string", example: "100 g" },
          cantidad: {
            type: "integer",
            description: "Puede ser MENOR que la pedida si se ajusto por stock o por tope.",
            example: 2,
          },
          precioUnitario: { type: "string", example: "8500.00" },
          subtotal: { type: "string", example: "17000.00" },
        },
      },
      AvisoCotizacion: {
        type: "object",
        description: "Algo que cambio respecto de lo que la persona tenia en el carrito.",
        required: ["varianteId", "motivo"],
        properties: {
          varianteId: { type: "integer" },
          motivo: {
            type: "string",
            enum: [
              "VARIANTE_INEXISTENTE",
              "VARIANTE_INACTIVA",
              "PRODUCTO_INACTIVO",
              "SIN_STOCK",
              "AJUSTADO_POR_STOCK",
              "AJUSTADO_POR_TOPE",
            ],
            description:
              "Los cuatro primeros sacan el producto del carrito. Los dos ultimos reducen la cantidad: AJUSTADO_POR_STOCK es un limite fisico, AJUSTADO_POR_TOPE es comercial y conviene invitar a escribir por WhatsApp.",
          },
          producto: { type: "string", description: "Nombre, para poder nombrarlo en el aviso." },
          pedida: { type: "integer", description: "Cantidad que habia en el carrito." },
          disponible: { type: "integer", description: "Solo en AJUSTADO_POR_STOCK." },
          maximo: { type: "integer", description: "Solo en AJUSTADO_POR_TOPE." },
        },
      },
      TotalesCotizacion: {
        type: "object",
        description: "Todos como cadena decimal. El total ya viene redondeado al peso.",
        required: ["subtotal", "total"],
        properties: {
          subtotal: { type: "string", example: "36500.00" },
          descuentoCupon: { type: "string", example: "0.00" },
          ajusteMedioPago: {
            type: "string",
            description: "Descuento por el medio de pago. Se RESTA del subtotal.",
            example: "3650.00",
          },
          costoEnvio: { type: "string", example: "6500.00" },
          total: { type: "string", example: "39350.00" },
        },
      },
      DetalleEnvio: {
        type: "object",
        required: ["modo"],
        properties: {
          modo: { type: "string", enum: ["retiro", "envio"] },
          zonaId: { type: "integer", nullable: true },
          nombre: { type: "string", nullable: true },
          demora: { type: "string", nullable: true },
          gratis: {
            type: "boolean",
            description: "Si se alcanzo el umbral DESPUES de aplicar los descuentos.",
          },
        },
      },
      Cotizacion: {
        type: "object",
        required: ["items", "avisos", "totales", "envio"],
        properties: {
          items: { type: "array", items: { $ref: "#/components/schemas/ItemCotizado" } },
          avisos: {
            type: "array",
            description: "Vacio si el carrito quedo tal como lo mandaron.",
            items: { $ref: "#/components/schemas/AvisoCotizacion" },
          },
          totales: { $ref: "#/components/schemas/TotalesCotizacion" },
          envio: { $ref: "#/components/schemas/DetalleEnvio" },
        },
      },

      PedidoEntrada: {
        type: "object",
        required: ["items", "cliente", "entrega", "medioPago", "totalEsperado"],
        properties: {
          items: {
            type: "array",
            minItems: 1,
            maxItems: 30,
            items: {
              type: "object",
              required: ["varianteId", "cantidad"],
              properties: {
                varianteId: { type: "integer", minimum: 1 },
                cantidad: { type: "integer", minimum: 1 },
              },
            },
          },
          cliente: {
            type: "object",
            required: ["nombre", "email", "telefono"],
            properties: {
              nombre: { type: "string", maxLength: 140, example: "Lucía Fernández" },
              email: { type: "string", format: "email", maxLength: 180 },
              telefono: { type: "string", maxLength: 40, example: "358 412-3344" },
              documento: { type: "string", nullable: true, maxLength: 20 },
            },
          },
          entrega: {
            type: "object",
            required: ["metodo"],
            description: "Con envio, zonaEnvioId y la direccion completa son obligatorios.",
            properties: {
              metodo: { type: "string", enum: ["envio", "retiro"] },
              zonaEnvioId: { type: "integer", nullable: true },
              direccion: {
                type: "object",
                nullable: true,
                properties: {
                  calle: { type: "string", maxLength: 180 },
                  numero: { type: "string", maxLength: 20 },
                  extra: {
                    type: "string",
                    nullable: true,
                    maxLength: 120,
                    example: "Piso 2, depto B",
                  },
                  ciudad: { type: "string", maxLength: 120 },
                  provincia: { type: "string", maxLength: 80 },
                  cp: { type: "string", maxLength: 20 },
                },
              },
            },
          },
          medioPago: { type: "string", enum: ["mercadopago", "transferencia"] },
          totalEsperado: {
            type: "string",
            description:
              "El total que la clienta vio en pantalla. Si no coincide con el real, se rechaza con TOTAL_CAMBIO.",
            example: "23500.00",
          },
          notas: { type: "string", nullable: true, maxLength: 500 },
        },
      },
      PedidoCreado: {
        type: "object",
        required: ["numero", "estadoPago", "medioPago", "total", "expiraEn"],
        properties: {
          numero: { type: "string", example: "VEL-4K7Q2X" },
          estadoPago: { type: "string", example: "pendiente" },
          medioPago: { type: "string", enum: ["mercadopago", "transferencia"] },
          total: { type: "string", example: "23500.00" },
          expiraEn: {
            type: "string",
            format: "date-time",
            description: "Hasta cuando queda apartado el stock si no se paga.",
          },
        },
      },
      PedidoPublico: {
        type: "object",
        description: "Estado de un pedido sin ningun dato personal.",
        properties: {
          numero: { type: "string", example: "VEL-4K7Q2X" },
          estadoPago: {
            type: "string",
            enum: ["pendiente", "aprobado", "rechazado", "devuelto", "cancelado"],
          },
          estadoPedido: {
            type: "string",
            enum: ["nuevo", "en_preparacion", "enviado", "entregado", "cancelado"],
          },
          medioPago: { type: "string", enum: ["mercadopago", "transferencia"] },
          metodoEntrega: { type: "string", enum: ["envio", "retiro"] },
          expiraEn: { type: "string", format: "date-time", nullable: true },
          comprobanteInformado: { type: "boolean" },
          seguimiento: { type: "string", nullable: true },
          creadoEn: { type: "string", format: "date-time" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                producto: { type: "string" },
                variante: { type: "string" },
                cantidad: { type: "integer" },
                precioUnitario: { type: "string" },
                subtotal: { type: "string" },
              },
            },
          },
          totales: { $ref: "#/components/schemas/TotalesCotizacion" },
        },
      },
    },
    responses: {
      DatosInvalidos: {
        description: "Datos invalidos. details trae un mensaje por campo.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "DATOS_INVALIDOS", details: { nombre: "El nombre es obligatorio" } },
          },
        },
      },
      NoAutorizado: {
        description: "Sin sesion, token invalido o expirado.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "NO_AUTORIZADO" },
          },
        },
      },
      SinPermiso: {
        description: "La sesion es valida pero el rol no tiene el permiso requerido.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "SIN_PERMISO" },
          },
        },
      },
      NoEncontrado: {
        description: "No existe un recurso con ese id.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "NO_ENCONTRADO" },
          },
        },
      },
      Conflicto: {
        description: "El slug ya esta en uso.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: { error: "CONFLICTO_DE_DATOS" },
          },
        },
      },
    },
  },
};
