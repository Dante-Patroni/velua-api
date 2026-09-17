# H1 · Catálogo público

*Estado: no iniciado. Depende de H0 cerrado.*

## Objetivo

Endpoints de lectura de categorías y productos, y las pantallas públicas que
los consumen.

**Terminado cuando:** se navega el catálogo del seed en producción, desde el
teléfono.

## Backend

- [ ] Modelos Sequelize de categoría, producto, variante e imagen
- [ ] Repositorios con su interfaz
- [ ] Servicio de catálogo
- [ ] Rutas y controllers de lectura
- [ ] Documentación OpenAPI movida a comentarios en las rutas
- [ ] Tests unitarios del servicio
- [ ] Colección Newman de los endpoints de catálogo

## Frontend

- [ ] Tipos generados desde el OpenAPI
- [ ] Rama de rutas de la tienda con su layout
- [ ] Portada con destacados
- [ ] Grilla por categoría
- [ ] Ficha de producto
- [ ] Buscador simple

## Decisiones tomadas

- El listado es liviano y la ficha es completa. Dos endpoints, dos propósitos.
- El detalle se busca por slug, no por id.
- En el listado: precio desde, si hay stock, y la imagen principal.