<!-- Un PR chico, de un solo tema. Lo que no aplique, borralo o marcalo "No aplica" con el motivo. -->

## Qué cambia y por qué


## Cómo se probó
<!-- Comandos y resultados (Jest, Newman, concurrencia), mutaciones, prueba manual. Lo que no se pudo probar, y por qué. -->


## Deploy
<!-- ¿Migración? (backup del día antes del merge, `down` probado). ¿Variables nuevas en Railway? ¿Qué verificar después (log, /salud)? -->


## Fuera de este PR
<!-- Lo que queda para otro PR, para que la revisión no lo busque acá. -->


## Seguridad
<!-- Cada pregunta con una línea: dónde está resuelto (archivo, test) o "No aplica" con el motivo. -->

- [ ] **¿Quién puede llegar a esto?** Ruta pública, con sesión o con un permiso. Si tiene permiso, hay un test con otro rol que recibe 403.
- [ ] **¿Valido lo que entra?** express-validator en la ruta; el controlador toma solo lo validado (`matchedData`) y arma los datos campo por campo. El usuario sale de la sesión (`req.usuario.id`), nunca del cuerpo.
- [ ] **¿Falla cerrado?** Sin configuración válida, o ante un error, la acción no se concede. El aviso nombra la variable, nunca su valor.
- [ ] **¿Dos pedidos a la vez?** Si decide sobre una fila (stock, estado, pago): `FOR UPDATE` dentro de la transacción e idempotente si se repite.
- [ ] **¿Datos personales o secretos?** Solo los necesarios; ninguno en logs, errores ni respuestas de más. Sin secretos ni datos reales en el repo (`.env.example` con valores vacíos).
- [ ] **¿Dependencias nuevas o actualizadas?** `npm audit --omit=dev` antes y después.
- [ ] **¿Algún test falla si saco el control?** (mutación)
