# Ideas y mejoras pendientes

Cosas que se nos ocurren mientras trabajamos y que no entran en el hito en curso.
Se revisan entre hito e hito. Nada de acá se implementa sin acordarlo antes.

## Infraestructura

- Extraer el andamiaje a un repositorio plantilla (`plantilla-api-node`) una vez
  cerrado el hito 0, con migraciones, seed y deploy funcionando. Marcarlo como
  template repository en GitHub.
- Hook de pre-commit con Husky para correr lint antes de commitear. El CI ya
  frena en el PR, así que es comodidad, no necesidad.
- Revisar el límite global de rate limit (100 req/min por IP). Puede quedar corto
  en el catálogo público, sobre todo con varios clientes detrás de la misma IP.

## Producto

- Servicio de conciliación automática de transferencias por CVU único por orden.
- Aviso de reposición cuando un producto agotado vuelve a tener stock.