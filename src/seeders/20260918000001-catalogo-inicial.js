"use strict";

const PRECIO = "8500.00";

/**
 * @description Categorías del catálogo. El orden define cómo se muestran en el menú.
 */
const CATEGORIAS = [
  {
    slug: "essence-botanique",
    nombre: "L’Essence Botanique",
    descripcion:
      "Jabones con ingredientes distintivos: leches, arcillas, carbón, cerveza, cacao, oleatos, infusiones y otros elementos botánicos.",
    orden: 1,
  },
  {
    slug: "art-du-savon",
    nombre: "L’Art du Savon",
    descripcion:
      "Jabones donde el diseño, los colores, las capas y las técnicas decorativas son protagonistas.",
    orden: 2,
  },
  {
    slug: "edition-unique",
    nombre: "Édition Unique",
    descripcion:
      "Creaciones irrepetibles nacidas de una inspiración puntual. Cada pieza tiene vetas y colores propios.",
    orden: 3,
  },
];

/**
 * @description Zonas de envío con tarifa plana. Los costos son provisorios.
 */
const ZONAS = [
  {
    nombre: "Río Cuarto y alrededores",
    costo: "0.00",
    demora: "Entrega en el día o al siguiente",
    orden: 1,
  },
  { nombre: "Provincia de Córdoba", costo: "6500.00", demora: "2 a 4 días hábiles", orden: 2 },
  { nombre: "Resto del país", costo: "9800.00", demora: "3 a 7 días hábiles", orden: 3 },
];

/**
 * @description Catálogo real de Velua. Los textos son de la marca.
 * Precio, stock y destacados son provisorios hasta que se confirmen.
 */
const PRODUCTOS = [
  {
    slug: "eclat-dore",
    categoriaSlug: "essence-botanique",
    nombre: "Éclat Doré",
    descripcionCorta:
      "Cerveza IPA y una envolvente fragancia de vainilla y coco en un jabón de carácter cálido y sofisticado.",
    descripcion:
      "Éclat Doré nace de la unión de nuestra fórmula de aceites y mantecas con cerveza IPA, en una pieza elaborada mediante saponificación en frío. Su fragancia de vainilla y coco aporta un perfil cálido y envolvente, mientras su estética dorada acompaña una experiencia de baño elegante y sensorial.",
    ingredientes:
      "Aceite de oliva, manteca de karité, aceite de coco, aceite de ricino, cerveza IPA, fragancia de vainilla y coco.",
    modoUso:
      "Humedecer el jabón y frotar suavemente sobre la piel húmeda. Enjuagar con abundante agua. Dejar secar sobre una jabonera con drenaje entre usos.",
    destacado: false,
    stock: 12,
    precioAnterior: null,
  },
  {
    slug: "ciel-de-soie",
    categoriaSlug: "art-du-savon",
    nombre: "Ciel de Soie",
    descripcionCorta:
      "Una pieza de diseño delicado, creada para convertir el ritual cotidiano del baño en una experiencia de belleza y suavidad.",
    descripcion:
      "Ciel de Soie pertenece a L’Art du Savon, la colección donde el diseño se vuelve protagonista. Elaborado mediante saponificación en frío con nuestra fórmula de aceites y mantecas, cada pieza celebra la armonía de las formas y los matices, transformando un objeto cotidiano en un pequeño gesto de belleza.",
    ingredientes: "Aceite de oliva, manteca de karité, aceite de coco, aceite de ricino.",
    modoUso:
      "Humedecer el jabón y frotar suavemente sobre la piel húmeda. Enjuagar con abundante agua. Dejar secar sobre una jabonera con drenaje entre usos.",
    destacado: false,
    stock: 8,
    precioAnterior: null,
  },
  {
    slug: "belle-ame",
    categoriaSlug: "essence-botanique",
    nombre: "Belle Âme",
    descripcionCorta:
      "Arcillas rosa y blanca se encuentran con la delicadeza de la lavanda en una pieza serena, suave y elegante.",
    descripcion:
      "Belle Âme combina nuestra fórmula de aceites y mantecas con arcilla rosa y arcilla blanca. Elaborado mediante saponificación en frío, su delicada fragancia de lavanda acompaña una experiencia de baño serena y refinada. Una creación de L’Essence Botanique donde los ingredientes distintivos y la sensibilidad de Veluá se encuentran.",
    ingredientes:
      "Aceite de oliva, manteca de karité, aceite de coco, aceite de ricino, arcilla rosa, arcilla blanca, fragancia de lavanda.",
    modoUso:
      "Humedecer el jabón y frotar suavemente sobre la piel húmeda. Enjuagar con abundante agua. Dejar secar sobre una jabonera con drenaje entre usos.",
    destacado: false,
    stock: 15,
    precioAnterior: null,
  },
  {
    slug: "chocolat-de-coco",
    categoriaSlug: "essence-botanique",
    nombre: "Chocolat de Coco",
    descripcionCorta:
      "Una combinación envolvente de leche de coco y cacao amargo, acompañada por el aroma luminoso de la naranja dulce.",
    descripcion:
      "Chocolat de Coco combina nuestra fórmula de aceites y mantecas con leche de coco y cacao amargo. Elaborado mediante saponificación en frío, el carácter profundo del cacao se encuentra con la suavidad de la leche de coco y una fragancia de naranja dulce que aporta una nota fresca, luminosa y deliciosamente envolvente.",
    ingredientes:
      "Aceite de oliva, manteca de karité, aceite de coco, aceite de ricino, leche de coco, cacao amargo, fragancia de naranja dulce.",
    modoUso:
      "Humedecer el jabón y frotar suavemente sobre la piel húmeda. Enjuagar con abundante agua. Dejar secar sobre una jabonera con drenaje entre usos.",
    destacado: false,
    stock: 10,
    precioAnterior: null,
  },
  {
    slug: "rose-eternelle",
    categoriaSlug: "art-du-savon",
    nombre: "Rose Éternelle",
    descripcionCorta:
      "Una pieza delicada y romántica, donde el diseño artesanal se encuentra con la elegancia atemporal del aroma a rosas.",
    descripcion:
      "Rose Éternelle celebra la belleza atemporal de las rosas desde L’Art du Savon. Elaborado mediante saponificación en frío con nuestra fórmula de aceites y mantecas, su diseño artesanal y su fragancia floral convierten cada pieza en un detalle romántico y elegante, pensado para acompañar el baño con una experiencia delicada y sensorial.",
    ingredientes:
      "Aceite de oliva, manteca de karité, aceite de coco, aceite de ricino, fragancia de rosas.",
    modoUso:
      "Humedecer el jabón y frotar suavemente sobre la piel húmeda. Enjuagar con abundante agua. Dejar secar sobre una jabonera con drenaje entre usos.",
    destacado: true,
    stock: 18,
    precioAnterior: null,
  },
  {
    slug: "velours",
    categoriaSlug: "art-du-savon",
    nombre: "Velours",
    descripcionCorta:
      "Cada pieza es única: formas y matices irrepetibles transforman un jabón artesanal en una pequeña obra de arte.",
    descripcion:
      "Velours expresa la esencia de L’Art du Savon: la belleza de lo irrepetible. Elaborado mediante saponificación en frío con nuestra fórmula de aceites y mantecas, cada corte revela una composición diferente. Su fragancia de naranja aporta una nota luminosa y fresca a una pieza donde diseño, artesanía y experiencia sensorial se encuentran.",
    ingredientes:
      "Aceite de oliva, manteca de karité, aceite de coco, aceite de ricino, fragancia de naranja.",
    modoUso:
      "Humedecer el jabón y frotar suavemente sobre la piel húmeda. Enjuagar con abundante agua. Dejar secar sobre una jabonera con drenaje entre usos.",
    destacado: false,
    stock: 6,
    precioAnterior: "9900.00",
  },
  {
    slug: "amande-sereine",
    categoriaSlug: "essence-botanique",
    nombre: "Amande Sereine",
    descripcionCorta:
      "La suavidad de la leche de almendras y el delicado aroma de lavanda convierten el baño en un pequeño ritual de calma.",
    descripcion:
      "Amande Sereine combina nuestra fórmula de aceites y mantecas con leche de almendras. Elaborado mediante saponificación en frío, su delicada fragancia de lavanda acompaña un ritual de baño sereno y envolvente. Una creación de L’Essence Botanique inspirada en la suavidad, la calma y esos pequeños momentos de cuidado cotidiano.",
    ingredientes:
      "Aceite de oliva, manteca de karité, aceite de coco, aceite de ricino, leche de almendras, fragancia de lavanda.",
    modoUso:
      "Humedecer el jabón y frotar suavemente sobre la piel húmeda. Enjuagar con abundante agua. Dejar secar sobre una jabonera con drenaje entre usos.",
    destacado: false,
    stock: 14,
    precioAnterior: null,
  },
  {
    slug: "eden",
    categoriaSlug: "art-du-savon",
    nombre: "Éden",
    descripcionCorta:
      "Una composición vibrante y luminosa, acompañada por las notas frescas de lima verbena y un diseño inspirado en la naturaleza.",
    descripcion:
      "Éden pertenece a L’Art du Savon, donde el diseño y la expresión visual son protagonistas. Elaborado mediante saponificación en frío con nuestra fórmula de aceites y mantecas, su fragancia de lima verbena aporta un carácter fresco y luminoso. Una pieza inspirada en la belleza espontánea de la naturaleza y en el placer de lo hecho a mano.",
    ingredientes:
      "Aceite de oliva, manteca de karité, aceite de coco, aceite de ricino, fragancia de lima verbena.",
    modoUso:
      "Humedecer el jabón y frotar suavemente sobre la piel húmeda. Enjuagar con abundante agua. Dejar secar sobre una jabonera con drenaje entre usos.",
    destacado: false,
    stock: 9,
    precioAnterior: null,
  },
  {
    slug: "eclat-noir",
    categoriaSlug: "essence-botanique",
    nombre: "Éclat Noir",
    descripcionCorta:
      "Con carbón activado y pensado especialmente para pieles grasas, combina notas de açaí y naranja dulce en una pieza sofisticada.",
    descripcion:
      "Creado especialmente pensando en pieles grasas, Éclat Noir incorpora carbón activado a nuestra fórmula de aceites y mantecas. Elaborado mediante saponificación en frío, su carácter intenso se completa con las notas frutales del açaí y la frescura de la naranja dulce, convirtiendo la limpieza diaria en un ritual sofisticado.",
    ingredientes:
      "Aceite de oliva, manteca de karité, aceite de coco, aceite de ricino, carbón activado, fragancia de açaí y naranja dulce.",
    modoUso:
      "Humedecer el jabón y frotar suavemente sobre la piel húmeda. Enjuagar con abundante agua. Dejar secar sobre una jabonera con drenaje entre usos.",
    destacado: true,
    stock: 20,
    precioAnterior: null,
  },
  {
    slug: "jardin-d-agrumes",
    categoriaSlug: "art-du-savon",
    nombre: "Jardin d’Agrumes",
    descripcionCorta:
      "Un jardín de notas cítricas convertido en jabón: fresco, luminoso y lleno de color, donde cada detalle celebra la alegría de la naturaleza.",
    descripcion:
      "Jardin d’Agrumes pertenece a L’Art du Savon. Elaborado mediante saponificación en frío con nuestra fórmula de aceites y mantecas, su identidad está puesta en el diseño y en una experiencia aromática fresca y luminosa.",
    ingredientes:
      "Aceite de oliva, manteca de karité, aceite de coco, aceite de ricino. Fragancia pendiente de confirmar.",
    modoUso:
      "Humedecer el jabón y frotar suavemente sobre la piel húmeda. Enjuagar con abundante agua. Dejar secar sobre una jabonera con drenaje entre usos.",
    destacado: false,
    stock: 0,
    precioAnterior: null,
  },
  {
    slug: "brise-de-menthe",
    categoriaSlug: "art-du-savon",
    nombre: "Brise de Menthe",
    descripcionCorta:
      "Una brisa fresca convertida en jabón. El aroma de la menta acompaña un diseño fluido y envolvente, lleno de movimiento.",
    descripcion:
      "Brise de Menthe pertenece a L’Art du Savon. Elaborado mediante saponificación en frío con nuestra fórmula de aceites y mantecas, combina una fragancia de menta con un diseño verde fluido y envolvente que evoca frescura y movimiento.",
    ingredientes:
      "Aceite de oliva, manteca de karité, aceite de coco, aceite de ricino, fragancia de menta.",
    modoUso:
      "Humedecer el jabón y frotar suavemente sobre la piel húmeda. Enjuagar con abundante agua. Dejar secar sobre una jabonera con drenaje entre usos.",
    destacado: false,
    stock: 11,
    precioAnterior: null,
  },
  {
    slug: "soleil-d-ete",
    categoriaSlug: "edition-unique",
    nombre: "Soleil d’Été",
    descripcionCorta:
      "Un atardecer en la piel. Colores que inspiran, un aroma que transporta. Una pieza irrepetible, creada para un momento especial.",
    descripcion:
      "Soleil d’Été inaugura Édition Unique: una creación inspirada en el mar, la playa y la luz de un atardecer. Elaborada mediante saponificación en frío, cada pieza celebra el carácter irrepetible del trabajo artesanal y no está pensada para reproducirse exactamente.",
    ingredientes:
      "Aceite de oliva, manteca de karité, aceite de coco, aceite de ricino. Fragancia pendiente de confirmar.",
    modoUso:
      "Humedecer el jabón y frotar suavemente sobre la piel húmeda. Enjuagar con abundante agua. Dejar secar sobre una jabonera con drenaje entre usos.",
    destacado: true,
    stock: 7,
    precioAnterior: null,
  },
  {
    slug: "reve-de-feu",
    categoriaSlug: "edition-unique",
    nombre: "Rêve de Feu",
    descripcionCorta:
      "La fuerza de los contrastes en una sola pieza. Colores que cuentan una historia, un aroma que envuelve, una creación irrepetible.",
    descripcion:
      "Rêve de Feu pertenece a Édition Unique. Su composición de negros, rojos y claros convierte el jabón en una pieza visual de gran carácter. Elaborado mediante saponificación en frío, fue concebido como una creación irrepetible.",
    ingredientes:
      "Aceite de oliva, manteca de karité, aceite de coco, aceite de ricino. Fragancia pendiente de confirmar.",
    modoUso:
      "Humedecer el jabón y frotar suavemente sobre la piel húmeda. Enjuagar con abundante agua. Dejar secar sobre una jabonera con drenaje entre usos.",
    destacado: false,
    stock: 0,
    precioAnterior: null,
  },
  {
    slug: "l-or-de-calendula",
    categoriaSlug: "essence-botanique",
    nombre: "L’Or de Calendula",
    descripcionCorta:
      "Una creación botánica donde la caléndula es protagonista, incorporada mediante oleato e infusión cuidadosamente preparados.",
    descripcion:
      "L’Or de Calendula nace de L’Essence Botanique. Elaborado mediante saponificación en frío, incorpora oleato de caléndula e infusión de caléndula a nuestra fórmula de aceites y mantecas. Su fragancia definitiva queda pendiente de definir para una futura versión.",
    ingredientes:
      "Aceite de oliva, manteca de karité, aceite de coco, aceite de ricino, oleato de caléndula, infusión de caléndula. Fragancia pendiente de definir.",
    modoUso:
      "Humedecer el jabón y frotar suavemente sobre la piel húmeda. Enjuagar con abundante agua. Dejar secar sobre una jabonera con drenaje entre usos.",
    destacado: false,
    stock: 13,
    precioAnterior: null,
  },
  {
    slug: "brise-fruitee",
    categoriaSlug: "edition-unique",
    nombre: "Brise Fruitée",
    descripcionCorta:
      "Una brisa de frescura y alegría. La combinación aromática de melón, pepino y banana envuelve el baño en una experiencia frutal y luminosa.",
    descripcion:
      "Brise Fruitée pertenece a Édition Unique. Elaborado mediante saponificación en frío, combina un diseño alegre con una fragancia de melón, pepino y banana. Fue concebido como una pieza especial y no como una creación de producción permanente.",
    ingredientes:
      "Aceite de oliva, manteca de karité, aceite de coco, aceite de ricino, fragancia de melón, pepino y banana.",
    modoUso:
      "Humedecer el jabón y frotar suavemente sobre la piel húmeda. Enjuagar con abundante agua. Dejar secar sobre una jabonera con drenaje entre usos.",
    destacado: false,
    stock: 5,
    precioAnterior: "9500.00",
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  /**
   * @description Carga categorías, productos, variantes y zonas de envío.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   */
  async up(queryInterface) {
    const ahora = new Date();

    await queryInterface.bulkInsert(
      "categorias",
      CATEGORIAS.map((c) => ({
        nombre: c.nombre,
        slug: c.slug,
        descripcion: c.descripcion,
        orden: c.orden,
        activa: true,
        creado_en: ahora,
        actualizado_en: ahora,
      }))
    );

    const categorias = await queryInterface.sequelize.query("SELECT id, slug FROM categorias", {
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    const idPorSlug = Object.fromEntries(categorias.map((c) => [c.slug, c.id]));

    await queryInterface.bulkInsert(
      "productos",
      PRODUCTOS.map((p) => ({
        categoria_id: idPorSlug[p.categoriaSlug],
        nombre: p.nombre,
        slug: p.slug,
        descripcion_corta: p.descripcionCorta,
        descripcion: p.descripcion,
        ingredientes: p.ingredientes,
        modo_uso: p.modoUso,
        activo: true,
        destacado: p.destacado,
        creado_en: ahora,
        actualizado_en: ahora,
      }))
    );

    const productos = await queryInterface.sequelize.query("SELECT id, slug FROM productos", {
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });
    const idProductoPorSlug = Object.fromEntries(productos.map((p) => [p.slug, p.id]));

    // Todos los productos tienen una única variante de 100 g.
    // El esquema exige al menos una variante por producto.
    await queryInterface.bulkInsert(
      "variantes",
      PRODUCTOS.map((p) => ({
        producto_id: idProductoPorSlug[p.slug],
        nombre: "100 g",
        sku: `VEL-${p.slug.toUpperCase().slice(0, 12)}`,
        precio: PRECIO,
        precio_anterior: p.precioAnterior,
        stock: p.stock,
        peso_gramos: 100,
        activa: true,
        creado_en: ahora,
        actualizado_en: ahora,
      }))
    );

    await queryInterface.bulkInsert(
      "zonas_envio",
      ZONAS.map((z) => ({
        nombre: z.nombre,
        costo: z.costo,
        demora_texto: z.demora,
        activa: true,
        orden: z.orden,
      }))
    );
  },

  /**
   * @description Vacía las tablas del catálogo en orden inverso al de carga.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   */
  async down(queryInterface) {
    await queryInterface.bulkDelete("zonas_envio", null, {});
    await queryInterface.bulkDelete("variantes", null, {});
    await queryInterface.bulkDelete("productos", null, {});
    await queryInterface.bulkDelete("categorias", null, {});
  },
};
