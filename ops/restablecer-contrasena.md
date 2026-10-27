# Restablecer la contraseña de alguien del panel

Mientras no exista la recuperación por mail (t42), si alguien del panel olvida su
contraseña, la restablece a mano el administrador. El login muestra
"¿Olvidaste tu contraseña?" con esa indicación.

## Antes de empezar
- Confirmar **por otro canal** (en persona o por teléfono) que quien lo pide es
  la dueña de la cuenta. Un pedido por mail o por chat puede ser un engaño.
- Tener a mano el mail exacto de la cuenta.

## Pasos
1. En velua-api, en tu máquina: `node scripts/hash-contrasena.js`.
   - Pide el mail y una contraseña temporal **por teclado, sin mostrarla**. No
     pasarla como argumento: quedaría en el historial y en la lista de procesos.
   - Aplica la misma política que la API (12 caracteres o más, no común, sin
     el mail ni el nombre de la marca) y el mismo costo de bcrypt.
2. Copiar la línea `UPDATE ...` que imprime y pegarla en Railway → MySQL →
   **Data**. Tiene que decir **1 fila afectada**. Si dice 0, el mail no
   coincide: no repetir con otro mail sin revisar.
3. Cerrar la terminal (o `cls`): el hash no tiene que quedar a la vista.
4. Darle la contraseña temporal a la dueña de la cuenta **en persona o por un
   canal privado**, nunca por el mismo canal en que pidió el cambio.
5. Que entre y la cambie enseguida en **Mi cuenta**. La API no puede obligarla:
   hay que pedírselo.

## Qué hace el UPDATE
- Reemplaza el hash de la contraseña.
- Sube `version_sesion`: cierra todas las sesiones abiertas de esa cuenta, en
  cualquier dispositivo.

## Probado
27/10/2026 en local: 1 fila afectada, la sesión abierta se cerró, la contraseña
anterior no entra y la nueva sí.