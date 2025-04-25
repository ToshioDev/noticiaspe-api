# API de Noticias - Uso de Proveedores y Endpoints

Esta API permite obtener noticias y categorías de múltiples fuentes mediante scraping optimizado. Actualmente soporta los siguientes proveedores:

- **La Jornada** (`site=jornada`)
- **El Peruano** (`site=elperuano`)
- **El Depor** (`site=eldepor`)

Todos los endpoints devuelven respuestas estructuradas y homogéneas para facilitar la integración.

---

## Endpoints disponibles

### 1. Obtener categorías

`GET /publicaciones/categorias?site=<proveedor>`

- **Parámetros**:
  - `site`: (obligatorio) Proveedor de noticias. Valores: `jornada`, `elperuano`.
- **Respuesta:**
```json
{
  "status": "ok",
  "ping": "123ms",
  "data": [
    { "id": 1, "name": "Actualidad", "url": "https://jornada.com.pe/category/actualidad/" },
    ...
  ]
}
```

### 2. Obtener noticias

`GET /publicaciones/noticias?site=<proveedor>[&categoria=<url>]`

- **Parámetros**:
  - `site`: (obligatorio) Proveedor de noticias. Valores: `jornada`, `elperuano`, `eldepor`.
  - `categoria`: (opcional) URL de la sección/categoría. Si se omite, trae noticias generales (más lento).
- **Respuesta:**
```json
{
  "status": "ok",
  "ping": "850ms", // o "1.42s" si el tiempo supera 1 segundo
  "data": [
    {
      "id": 1,
      "title": "Título de la noticia",
      "url": "https://jornada.com.pe/actualidad/noticia-ejemplo",
      "source": "Jornada",
      "summary": "Extracto reducido del contenido...",
      "img": "https://...jpg",
      "date": "2025-04-24T22:07:06-05:00",
      "titulo_detalle": "Título completo",
      "subtitulo": "Subtítulo si existe",
      "contenido": "Texto completo de la noticia"
    },
    ...
  ]
}
```

- Si el sitio no está soportado:
```json
{
  "status": "error",
  "ping": "0ms",
  "data": [],
  "message": "Sitio no soportado"
}
```

---

## Cómo funciona cada proveedor

### La Jornada (`site=jornada`)
- Usa `/publicaciones/categorias?site=jornada` para obtener todas las categorías y URLs.
- Usa `/publicaciones/noticias?site=jornada&categoria=<url>` para obtener noticias de una categoría específica (más rápido y preciso).
- Si omites `categoria`, obtienes noticias generales del sitio (más lento).
- El campo `summary` es un extracto reducido del contenido de la noticia.

### El Peruano (`site=elperuano`)
- Usa `/publicaciones/categorias?site=elperuano` para obtener las secciones/categorías.
- Usa `/publicaciones/noticias?site=elperuano&categoria=<url>` para obtener noticias de la sección. El campo `date` está formateado a ISO 8601 con zona horaria -05:00.

### El Depor (`site=eldepor`)
- No tiene endpoint de categorías. Usa `/publicaciones/noticias?site=eldepor&categoria=peruano` o `categoria=internacional`.
- Responde con noticias de fútbol peruano o internacional según la categoría.

---

## Ejemplos de uso

```bash
# Obtener categorías de La Jornada
curl "http://localhost:3000/publicaciones/categorias?site=jornada"

# Obtener noticias de una categoría específica de La Jornada
curl "http://localhost:3000/publicaciones/noticias?site=jornada&categoria=https://jornada.com.pe/local/"

# Obtener noticias de El Peruano (sección)
curl "http://localhost:3000/publicaciones/noticias?site=elperuano&categoria=https://elperuano.pe/seccion-ejemplo"

# Obtener noticias de fútbol peruano en El Depor
curl "http://localhost:3000/publicaciones/noticias?site=eldepor&categoria=peruano"
```

---

## Notas adicionales
- Todos los arrays de respuesta tienen un campo `id` numérico incremental.
- El campo `ping` indica el tiempo de respuesta en milisegundos, mostrado como "Xms" o "X.Xs" según corresponda.
- Si ocurre un error o el sitio no está soportado, la respuesta es homogénea y fácil de manejar.

¿Dudas, sugerencias o bugs? Abre un issue o contacta al responsable del repositorio.
