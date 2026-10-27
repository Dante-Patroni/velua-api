# Restablecer la contraseña de alguien del panel

Mientras no exista la recuperación por mail (t42), si alguien del panel olvida su
contraseña, la restablece a mano quien tenga acceso a Railway. El login muestra
"¿Olvidaste tu contraseña?" con esa indicación.

El procedimiento **no pasa por el panel**: sirve también si quien olvidó la
contraseña es la única administradora.

## Antes de empezar
- Confirmar **por otro canal** (en persona o por llamada) que quien lo pide es
  la dueña de la cuenta. Un pedido por mail o por chat puede ser un engaño.
- Tener a mano el mail exacto de la cuenta.

## Pasos
1. **Comprobar la cuenta** en Railway → MySQL → Data:
   `SELECT id, nombre, rol, activo FROM usuarios WHERE email = '<mail>';`
   Tiene que devolver 1 fila con `activo = 1`. Si no, no seguir.
2. **Generar el UPDATE** en tu máquina, en velua-api: `node scripts/hash-contrasena.js`.
   - Pide el mail y una contraseña temporal **por teclado, sin mostrarla**. No
     pasarla como argumento: quedaría en el historial y en la lista de procesos.
   - Aplica la misma política que la API (12 caracteres o más, no común, sin
     el mail ni el nombre de la marca) y el mismo costo de bcrypt.
   - Si mientras se escribe se usa Retroceso, la pregunta puede desaparecer de
     la pantalla. La contraseña igual no se ve: seguir escribiendo.
3. **Aplicarlo:** pegar la línea `UPDATE ...` en Railway → MySQL → **Data**.
   Tiene que decir **1 fila afectada**. Si dice 0, el mail no coincide: no
   repetir con otro mail sin revisar.
4. **Limpiar:** cerrar la terminal (o `cls`). El hash no se pega en ningún chat.
5. **Entregar la temporal** a la dueña de la cuenta **en persona o por
   llamada**, nunca por el mismo canal en que pidió el cambio. Si no queda otra
   que mandarla por escrito, borrar el mensaje después.
6. **Verificar:** que entre al panel con la temporal y confirme que funcionó.
7. **Que la cambie** enseguida en **Mi cuenta** por una que solo sepa ella. La
   API no puede obligarla: hay que pedírselo. Al cambiarla, se vuelven a cerrar
   las demás sesiones.

## Qué hace el UPDATE
- Reemplaza el hash de la contraseña.
- Sube `version_sesion`: cierra todas las sesiones abiertas de esa cuenta, en
  cualquier dispositivo.

## Probado
27/10/2026 en local: 1 fila afectada, la sesión abierta se cerró, la contraseña
anterior no entra y la nueva sí. El script, con cinco casos (corta, distintas,
válida, con el nombre de la marca y mail con comilla), sin que se vea lo que se
escribe.
