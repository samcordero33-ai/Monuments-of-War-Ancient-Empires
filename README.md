# Monuments of War · Ancient Empires

Prototipo jugable de **RTS 3D low-poly** ambientado en los Andes y el Mayab.
Incas contra Mayas, con referencias directas a **Sacsayhuamán**, el **Coricancha** y el
**Willaq Umu**, frente a la **Pirámide de Kukulcán**.

Todo se ejecuta **en el navegador** (client-side): no hay servidor, no hay base de datos,
no hay anuncios ni redes de afiliados.

**Demo en vivo:** https://samcordero33-ai.github.io/Monuments-of-War-Ancient-Empires/

---

## Qué incluye

| Sistema | Detalle |
|---|---|
| Motor | Three.js r160 por CDN (importmap, sin build step) |
| Terreno | Heightmap procedural determinista, flat-shading, agua, cordillera perimetral |
| Facciones | Inca (jugador) y Maya (IA) con 3 unidades cada una |
| Unidades | Guerrero Chakana, Hondero Andino, **Willaq Umu** · Guerrero Jaguar, Lancero Atlatl, Ah K'in |
| Estructuras | Coricancha, Terrazas Agrícolas, Muros de contención, Sacsayhuamán, Pirámide de Kukulcán |
| Economía | Oro (terrazas) e Inti (Coricancha) con tasas en tiempo real |
| Combate | Cuerpo a cuerpo, proyectiles con seguimiento, curación de área, barras de vida |
| IA | Oleadas crecientes + entrenamiento automático desde la pirámide |
| Interfaz | HUD oscuro, minimapa en vivo, panel de selección, crónica de guerra, modales de lore |
| Monetización | Botón de donación directa a PayPal / PayPal.Me (sin AdSense, sin afiliados) |

## Controles

| Entrada | Acción |
|---|---|
| Clic izquierdo | Seleccionar unidad o edificio |
| Arrastrar | Selección por caja |
| Clic derecho | Mover · atacar · fijar punto de reunión |
| `W` `A` `S` `D` / flechas | Desplazar cámara |
| Rueda | Zoom |
| `Q` / `E` | Rotar cámara |
| `1` `2` `3` | Entrenar Chakana · Hondero · Willaq Umu |
| `B` | Bendición del Sol (Willaq Umu seleccionado) |
| `Esc` | Cancelar construcción / cerrar modal |

## Objetivo

Destruir la **Pirámide de Kukulcán** sin perder el **Coricancha**.
Las oleadas llegan cada 34 s y crecen en número: la economía de terrazas
es lo que decide la partida.

---

## Ejecutar en local

Al usar módulos ES, hace falta servir el directorio por HTTP (no vale `file://`):

```bash
python3 -m http.server 8080
# abrir http://localhost:8080
```

## Estructura

```
index.html               # shell de la interfaz + importmap de Three.js
css/style.css            # tema oscuro (azul · celeste · plata · blanco · negro)
js/config.js             # ajustes globales y enlace de donación
js/terrain.js            # heightmap, malla low-poly, agua, decoración instanciada
js/monuments.js          # Sacsayhuamán, Coricancha, terrazas, pirámide maya, juego de pelota
js/units.js              # estadísticas y mallas de unidades/estructuras
js/game.js               # simulación: selección, órdenes, combate, economía, IA
js/ui.js                 # HUD, minimapa, modales, crónica
js/main.js               # escena, cámara, entrada, bucle de render
.github/workflows/deploy.yml
```

## Configurar la donación

Edita `js/config.js`:

```js
PAYPAL_URL: 'https://www.paypal.com/paypalme/TU_USUARIO',
```

Sustituye `TU_USUARIO` por tu enlace real de PayPal.Me o por una URL de donación
(`https://www.paypal.com/donate/?business=...`). El botón «Apoyar el desarrollo»
de la barra superior y el del modal usan ese valor.

## Despliegue

Cada push a `main` publica el sitio en GitHub Pages mediante
`.github/workflows/deploy.yml` (artefacto estático + `actions/deploy-pages`).

Para activarlo por primera vez: **Settings → Pages → Source: GitHub Actions**.

## Rendimiento

Escena ≈ 24 000 triángulos y ~220 draw calls con la hueste completa.
Pensado para 60 fps en GPU integrada; el `devicePixelRatio` se limita a 1,75.

## Licencia

Prototipo con fines de demostración. Three.js se distribuye bajo licencia MIT.
