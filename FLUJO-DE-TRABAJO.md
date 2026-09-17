# Flujo de trabajo con los repositorios

Copia idéntica en `velua-api` y `velua-web`.

---

## 1) El cambio de mentalidad

Hasta ahora Git era una copia de respaldo: se trabajaba en local, se commiteaba cuando uno se acordaba y se subía todo a `main`. Funciona cuando trabaja una sola persona y a nadie le importa el historial.

Acá cambian tres cosas:

**`main` está siempre desplegable.** Lo que está en `main` es lo que va a producción. Si `main` está roto, la tienda está rota.

**Nadie escribe en `main`.** Ni vos, ni Pablo, ni en un cambio de una línea. Todo entra por pull request.

**El historial es parte del entregable.** Alguien que mire el repo en una entrevista va a ver los commits y los PR antes que el código. Un historial de mensajes tipo "cambios" y "arreglos varios" dice más sobre cómo trabajás que cualquier README.

---

## 2) El ciclo, paso a paso

Este es el bucle completo. Se repite para cada tarea, todos los días.

```bash
# 1. Partir siempre de main actualizado
git switch main
git pull

# 2. Crear la rama de la tarea
git switch -c feat/cotizador

# 3. Trabajar. Commits chicos, a medida que algo queda andando.
git add src/services/cotizador.js
git commit -m "feat(cotizador): calcular subtotal y descuento por cupon"

# 4. Subir la rama
git push -u origin feat/cotizador

# 5. Abrir el pull request en GitHub, describir qué hace y qué probaste

# 6. La otra persona revisa y aprueba

# 7. Merge con squash desde GitHub, y borrar la rama remota

# 8. Volver a local y limpiar
git switch main
git pull
git branch -d feat/cotizador
```

Entre el paso 3 y el 4 puede haber varios días. Si son más de dos, la rama es demasiado grande.

---

## 3) Nombres de ramas

```
feat/    funcionalidad nueva        feat/checkout-mercadopago
fix/     corrección de un error     fix/webhook-duplicado
chore/   infraestructura, config    chore/workflow-ci
docs/    solo documentación         docs/contrato-catalogo
test/    solo tests                 test/cotizador-cupones
```

En minúsculas, con guiones, sin acentos. Que se entienda qué hay adentro sin abrir el PR.

---

## 4) Commits

Uno por unidad lógica que funciona. No uno por archivo, ni uno por día.

Formato:

```
tipo(alcance): qué cambia

Por qué hacía falta, si no es obvio.
```

Ejemplos buenos:

```
feat(pedidos): reservar stock dentro de la transaccion de checkout
fix(webhook): cortar si el payment_id ya fue procesado
chore(ci): correr migraciones antes de los tests
```

Ejemplos que no queremos: `cambios`, `wip`, `andaba mal`, `update`.

Regla práctica: si el mensaje necesita la palabra "y", probablemente son dos commits.

---

## 5) Pull requests

La descripción del PR es donde se explica el porqué. El código muestra el qué.

Plantilla mínima:

```markdown
## Qué hace

Dos o tres líneas.

## Por qué

Qué problema resuelve o a qué parte del PLAN corresponde.

## Cómo lo probé

Tests que corrí, endpoints que golpeé, qué verifiqué a mano.

## Pendientes

Lo que queda para otro PR.

Closes #12
```

Reglas:

- Un PR chico se revisa bien; uno de dos mil líneas se aprueba sin leer. Apuntá a menos de cuatrocientas líneas.
- No mezclar refactor masivo con arreglo puntual.
- El PR no se aprueba si toca un endpoint y no actualizó el OpenAPI.
- El PR no se aprueba con tests en rojo.
- **Merge con squash**, siempre. Deja un commit limpio por tarea en `main` y hace que el historial se pueda leer.

Revisar el PR del otro no es un trámite. Con dos personas, es lo único que evita que cada uno sea el único que entiende su mitad.

---

## 6) Cuando una rama se queda atrás

Si mientras trabajabas entró otra cosa a `main`:

```bash
git switch main
git pull
git switch feat/mi-rama
git merge main
# resolver conflictos si los hay
git push
```

Se usa `merge`, no `rebase`. `rebase` deja un historial más lindo y reescribe commits ya publicados, que es una forma conocida de perder trabajo cuando recién se arranca. Cuando el flujo esté incorporado, se puede cambiar.

---

## 7) Qué nunca se commitea

- `.env` y cualquier archivo con credenciales reales
- `node_modules/`, `dist/`, `coverage/`
- Claves de Mercado Pago, de Cloudinary o del proveedor de mail
- Archivos subidos por usuarios

El `.gitignore` va en el primer commit del repo, antes que cualquier otra cosa. Si un secreto llega a entrar, no alcanza con borrarlo en un commit siguiente: queda en el historial y hay que rotar la credencial.

---

## 8) Issues como lista de tareas

Cada tarea del `PLAN.md` es un issue. El PR lo cierra con `Closes #N`.

Sirve para tres cosas: saber en qué está el otro sin preguntar, tener el porqué de cada cambio escrito en algún lado, y que el repo muestre cómo se organizó el trabajo.

Etiquetas mínimas: `backend`, `frontend`, `bug`, `bloqueante`.

---

## 9) Cómo se coordinan los dos repos

Son repos separados, y eso está bien: distinto stack, distinto deploy, distinto ritmo. La coordinación pasa por dos archivos y nada más:

**`DECISIONES.md`**, idéntico en ambos. Cambiar una línea de ahí se habla antes. El PR que la cambia va acompañado del PR espejo en el otro repo.

**El contrato OpenAPI**, que vive en `velua-api/docs/openapi.json` y se commitea. El frontend genera sus tipos desde ahí:

```json
"scripts": {
  "tipos": "openapi-typescript https://raw.githubusercontent.com/TU-USUARIO/velua-api/main/docs/openapi.json -o src/types/api.generated.ts"
}
```

Así, cuando el backend cambia una respuesta y la mergea, a Pablo le rompe la compilación en cuanto regenera. Es el desencuentro apareciendo donde tiene que aparecer.

---

## 10) Trabajar con un agente dentro de este flujo

Una sesión del agente equivale a una rama y a un pull request. Se abre la rama antes de empezar, se trabaja la tarea, se commitea y se cierra la sesión.

No dejar que el agente trabaje sobre `main`, ni que arrastre tres tareas distintas en la misma rama. El PR chico y revisable vale más que la velocidad.

Y lo que el agente escribe se lee antes de commitear. Firma tuya, responsabilidad tuya.
