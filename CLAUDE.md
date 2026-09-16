# Velua API

Tienda online de Velua, cosmética natural artesanal.
Node + Express + MySQL (Sequelize). Capas: Route → Controller → Service → Repository.
Sin MongoDB y sin Socket.IO.

@AGENTS.md

## Comandos

- `npm run dev` — servidor en desarrollo
- `npm run test:unit` — Jest
- `npm test` — Newman contra la colección de Postman
- `npx sequelize-cli db:migrate` — migraciones
- `npx sequelize-cli db:seed:all` — datos de prueba

## Antes de implementar

Leer la sección 4 de AGENTS.md. Las reglas de dominio no se negocian:
cotizador único, máquina de estados, webhook idempotente, precios congelados,
stock y pedido en la misma transacción.
