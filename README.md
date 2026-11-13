# Monuments of War · Ancient Empires

Prototipo jugable de **RTS 3D low-poly** para móvil y escritorio, ambientado en los Andes y el Mayab.
Elige **Imperio Inca** o **Civilización Maya**: la facción que no elijas la controla la IA,
que recolecta, construye y ataca por oleadas.

Todo corre **en el navegador**: sin servidor, sin base de datos, sin anuncios ni afiliados.

**Demo en vivo:** https://samcordero33-ai.github.io/Monuments-of-War-Ancient-Empires/

---

## Selección de facción

| | Imperio Inca | Civilización Maya |
|---|---|---|
| Centro urbano | Coricancha | Pirámide de Kukulcán |
| Cuartel | **Sacsayhuamán** (muros en zigzag) | Campo de Pelota |
| Edificio especial | Templo del Sol | Observatorio **El Caracol** |
| Defensa | Torre de Vigilancia | Atalaya de Piedra |
| Recolector | Chasqui | Aldeano Maya |
| Infantería | Guerrero Chakana | Guerrero Jaguar |
| Distancia | Hondero Andino | Arquero de Obsidiana |
| Élite | **Willaq Umu** | Chamán de Chichén |

## Combate: piedra, papel o tijera

```
Infantería  ▸ +50 % ▸  Distancia  ▸ +50 % ▸  Especial  ▸ +50 % ▸  Infantería
```

El daño final aplica el bonus de clase y descuenta defensa:
`daño = max(2, ATQ × multiplicador − DEF × 0,5)`. La ficha de cada unidad muestra
contra qué es fuerte (▲) y débil (▼).

### Estadísticas

| Unidad | Clase | HP | ATQ | DEF |
|---|---|:--:|:--:|:--:|
| Chasqui / Aldeano | Recolector | 60 | 5 | 2 |
| Guerrero Chakana | Infantería | 140 | 18 | 12 |
| Hondero Andino | Distancia | 90 | 22 | 5 |
| Willaq Umu | Especial | 110 | 28 | 8 |
| Guerrero Jaguar | Infantería | 130 | 21 | 10 |
| Arquero de Obsidiana | Distancia | 85 | 24 | 4 |
| Chamán de Chichén | Especial | 115 | 27 | 9 |

## Economía

Los aldeanos recogen **oro** y **piedra** de los yacimientos y los llevan al centro urbano
(7 ud/s, 20 por viaje). El **Inti** lo generan el Templo del Sol / El Caracol y alimenta
a las unidades de élite. El centro urbano puede **ampliar la hueste** (+10 por 220 oro y 120 piedra).

## Controles

**Táctil**

| Gesto | Acción |
|---|---|
| Tocar unidad / edificio | Seleccionar |
| Tocar el suelo | Mover las unidades seleccionadas |
| Tocar enemigo | Atacar |
| Tocar yacimiento | Enviar aldeanos a recolectar |
| Arrastrar 1 dedo | Mover la cámara |
| Pellizcar | Zoom |
| Botón ⛶ | Pantalla completa (Fullscreen API) |

**Ratón y teclado**

| Entrada | Acción |
|---|---|
| Clic izquierdo / arrastrar | Seleccionar / caja de selección |
| Clic derecho | Mover · atacar · punto de reunión |
| `W` `A` `S` `D`, rueda | Cámara y zoom |
| `1` `2` `3` | Entrenar infantería · distancia · élite |
| `B` | Liturgia solar (élite seleccionada) |
| `F` | Pantalla completa · `Esc` cancelar |

## Ejecutar en local

```bash
python3 -m http.server 8080
# http://localhost:8080
```

## Estructura

```
index.html               # shell + pantalla de facción + importmap de Three.js
css/style.css            # tema oscuro, layout táctil, responsive
js/config.js             # ajustes, economía, enlace de donación
js/terrain.js            # heightmap, malla low-poly, agua, decoración
js/monuments.js          # Coricancha, Sacsayhuamán, pirámide, El Caracol, torres, yacimientos
js/units.js              # estadísticas, clases de combate y mallas
js/game.js               # simulación: aldeanos, economía, combate, IA, construcción
js/ui.js                 # HUD, barra de mando, minimapa, modales
js/main.js               # escena, cámara, entrada táctil/ratón, bucle
.github/workflows/deploy.yml
```

## Configurar la donación

En `js/config.js`:

```js
PAYPAL_URL: 'https://www.paypal.com/paypalme/TU_USUARIO',
```

Sustitúyelo por tu PayPal.Me o una URL `https://www.paypal.com/donate/?business=...`.
Lo usan el botón del corazón en la barra superior, el enlace del menú inicial y el modal de apoyo.

## Despliegue

Cada push a `main` publica el sitio con `.github/workflows/deploy.yml`
(artefacto estático + `actions/deploy-pages`). Pages debe estar en
**Settings → Pages → Source: GitHub Actions**.

## Licencia

Prototipo con fines de demostración. Three.js se distribuye bajo licencia MIT.
