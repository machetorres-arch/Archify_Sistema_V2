# Plan de Implementación: Estandarización de Despiece de Cajones (Opción 2) - Rieles Telescópicos 13 mm

Ajuste paramétrico y normalización técnica del despiece de cajones en el configurador, generador Excel y láminas PDF, conforme a la **Opción 2** seleccionada por el usuario (laterales exteriores pasantes y testeros interiores embutidos).

---

## 1. Fundamento Matemático y Geométrico (Módulo Base 450 mm, Melamina 15 mm)

* **Ancho exterior del mueble:** $450\text{ mm}$
* **Vano interior libre útil ($LW$):** $450 - (2 \times 15) = 420\text{ mm}$
* **Descuento de rieles telescópicos:** $13\text{ mm (izquierdo)} + 13\text{ mm (derecho)} = \mathbf{26\text{ mm total}}$
* **Ancho exterior total de la caja de cajón armada ($SKW$):** $420 - 26 = \mathbf{394\text{ mm}}$
* **Largo nominal corredera ($NL$):** $500\text{ mm}$

### Piezas resultantes en Opción 2 (Laterales pasantes de 500 mm):
1. **Laterales de cajón (2 un):**
   * Largo: $500.0\text{ mm}$
   * Alto: $120.0\text{ mm}$ (cajones superiores) / $180.0\text{ mm}$ (cajón ollero)
   * Espesor: $15.0\text{ mm}$
2. **Contrafrente frontal y Trasera interior (2 un):**
   * Largo: $394\text{ mm (ancho exterior caja)} - (2 \times 15\text{ mm espesor laterales}) = \mathbf{364.0\text{ mm}}$
   * Alto: $120.0\text{ mm}$ / $180.0\text{ mm}$
   * Espesor: $15.0\text{ mm}$
   * *Verificación geométrica:* $364 + 15 + 15 = 394\text{ mm}$. Luz libre restante en el mueble: $420 - 394 = 26\text{ mm} \rightarrow \mathbf{13\text{ mm a cada lado}}$.
3. **Fondo de cajón:**
   * **Modo A (Fondo melamina 15 mm a tope por debajo):** $500.0 \times 394.0\text{ mm}$ con nota técnica explícita en Excel y PDF indicando que atornilla a ras exterior de la caja armada.
   * **Modo B (Fondo ranurado Durolac 3-5.5 mm s/ nota técnica MC.2.02):** $490.0 \times 378.0\text{ mm}$ ($364\text{ mm interior} + 14\text{ mm de ranuras perimetrales}$).
   * Normalización en el código para sincronizar la descripción del fondo entre el BOM, la ficha técnica y la lista de corte.

---

## 2. Archivos a Intervenir y Alcance Quirúrgico

### A. `src/utils/kitchenManufacturing.ts`
* Refinar las notas técnicas de corte en las piezas de cajón para evitar ambigüedades en maestranza:
  * Contrafrente: `"Testero frontal interior. Ancho ext. caja armada = 394mm (Rieles telescópicos 13mm c/lado)"`
  * Trasera: `"Testero posterior interior. Ancho ext. caja armada = 394mm (Rieles telescópicos 13mm c/lado)"`
  * Fondo de cajón: clarificar si es fondo a tope exterior ($394\text{ mm}$) o ranurado interior ($378\text{ mm}$) en concordancia con el material seleccionado.

### B. `src/utils/kitchenPdfGenerator.ts`
* En la **Lámina 4 (Despiece de Cajones)**:
  * Incorporar en la vista 2D acotada una cota auxiliar o indicación que exprese: `Ancho Ext. Caja = 394 mm | Vano = 420 mm | Rieles = 13 mm c/lado`.
  * Mantener el contrafrente y trasera en $364\text{ mm}$ con su acotación técnica limpia y sin solapamientos.

### C. `src/utils/excelGenerator.ts` y `src/utils/kitchenExcelGenerator.ts`
* Asegurar que las columnas `G (Largo)` y `H (Ancho)` junto con la columna `O (Notas)` en la hoja `1_Placas_y_Cortes` entreguen la información idéntica y libre de discrepancias.

---

## 3. Criterios de Aceptación y Verificación (Completados)

- [x] Un módulo de $450\text{ mm}$ con melamina de $15\text{ mm}$ arroja exactamente:
  - Vano interior mueble: $420\text{ mm}$.
  - Laterales cajón: $500\text{ mm}$.
  - Contrafrente y trasera: $364\text{ mm}$.
  - Base / Fondo del cajón: $364\text{ mm}$ de ancho (encajado entre laterales).
  - Ancho exterior caja armada: $364 + 15 + 15 = 394\text{ mm}$.
  - Espacio para rieles telescópicos: $13\text{ mm}$ a cada lado ($26\text{ mm}$ total).
- [x] La columna de notas de Excel y los textos de cotas del PDF explican inequívocamente la relación $364\text{ mm} + 30\text{ mm} = 394\text{ mm}$.
- [x] El proyecto compila limpiamente (`compile_applet` y `lint_applet` sin errores).
- [x] No se alteran mallas 3D, controladores de cámara ni lógicas ajenas a la planimetría/BOM.
