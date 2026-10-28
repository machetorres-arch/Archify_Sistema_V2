import { Part } from './manufacturing';
import { CabinetType } from '../store/kitchenStore';
import { KitchenHandleConfig } from '../types/handle';
import { isCabinetWithDoors, getCabinetHingesPositions, getResolvedCabinetShelfElevations } from './kitchenManufacturing';

export interface CncDrill {
  id: string;
  type: 'hinge_cup_35' | 'hinge_plate_5' | 'slide_hole_5' | 'shelf_pin_5' | 'minifix_15' | 'minifix_bolt_8' | 'dowel_8' | 'screw_confirmat_5' | 'handle_hole';
  face: 'face_A' | 'face_B' | 'edge_L1' | 'edge_L2' | 'edge_W1' | 'edge_W2';
  x: number; // mm from bottom-left corner of piece (0 to width)
  y: number; // mm from bottom-left corner (0 to length)
  diameter: number; // mm
  depth: number; // mm
  label: string;
}

export interface CncGroove {
  id: string;
  name: string;
  face: 'face_A' | 'face_B';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number; // e.g. 4mm
  depth: number; // e.g. 8mm
}

export interface CncPocket {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
}

export interface CncMachinedPart {
  partCode: string;
  partName: string;
  moduleTag: string;
  moduleName: string;
  width: number; // mm
  length: number; // mm
  thickness: number; // mm
  material: string;
  grainDirection: 'vertical' | 'horizontal';
  edgeL1: boolean; // Left long edge
  edgeL2: boolean; // Right long edge
  edgeW1: boolean; // Top short edge
  edgeW2: boolean; // Bottom short edge
  edgeThicknessL1: number;
  edgeThicknessL2: number;
  edgeThicknessW1: number;
  edgeThicknessW2: number;
  notes: string;
  drills: CncDrill[];
  grooves: CncGroove[];
  pockets: CncPocket[];
}

/**
 * Calcula el despiece con mapeo paramétrico exhaustivo de perforaciones Sistema 32
 * para máquinas CNC (Router / Punto a Punto) y centros de mecanizado.
 */
export function calculateCncMachiningForPart(
  part: Part,
  cab: CabinetType | undefined,
  hardwareBrand: 'Hafele' | 'Provelcar' = 'Hafele',
  assemblyType: 'spax' | 'minifix' = 'minifix',
  golaSystem: 'none' | 'aluminum' | 'black' = 'none',
  handleConfig?: KitchenHandleConfig,
  hasDurolacBack: boolean = false
): CncMachinedPart {
  const nameLower = part.name.toLowerCase();
  const isDrawerFront = nameLower.includes('frente cajón') || (nameLower.includes('frente') && !nameLower.includes('contrafrente'));
  const isDrawerSide = nameLower.includes('lateral cajón');
  const isDrawerPart = nameLower.includes('cajón') || nameLower.includes('cajon');
  const isBarra = nameLower.includes('barra') || nameLower.includes('amarre');

  const th = Math.round(part.thickness);

  // En despiece industrial, los frentes de cajón y traseras de gabinete tienen su dimensión horizontal en part.length y altura en part.width.
  // Para CNC y orientación de mecanizado: pw = ancho frontal (X), pl = alto frontal (Y)
  const isBack = !isDrawerPart && !isBarra && (th <= 4 || nameLower.includes('trasera') || (nameLower.includes('fondo') && !nameLower.includes('soporte')));
  const isFrenteHoriz = (isDrawerFront && part.length > part.width) || isBack;
  const pw = Math.round(isFrenteHoriz ? part.length : part.width);   // mm
  const pl = Math.round(isFrenteHoriz ? part.width : part.length);   // mm

  const drills: CncDrill[] = [];
  const grooves: CncGroove[] = [];
  const pockets: CncPocket[] = [];

  const isLateral = nameLower.includes('lateral') && !isDrawerPart;
  const isPiso = (nameLower.includes('piso') || (nameLower.includes('base') && !nameLower.includes('soporte'))) && !isDrawerPart;
  const isTecho = (nameLower.includes('techo') || nameLower.includes('tapa superior') || nameLower.includes('tapa melamina') || isBarra) && !isDrawerPart && !nameLower.includes('tapa lateral');
  const isDoor = nameLower.includes('puerta');
  const isRepisa = nameLower.includes('repisa') || nameLower.includes('estante');

  const isBaseOrIsland = cab ? (cab.type === 'base' || cab.type === 'island') : true;
  const isWall = cab ? cab.type === 'wall' : false;
  const isTall = cab ? cab.type === 'tall' : false;

  // 1. LATERALES DE GABINETES
  if (isLateral && !isDrawerSide) {
    // 1.1 Ranura posterior para fondo Durolac 4mm (Groove)
    // Solo si el gabinete utiliza trasera delgada de Durolac (<= 4mm).
    // Si la trasera es de melamina estructural (15mm o 18mm), no lleva ranura de 4mm.
    if (hasDurolacBack) {
      grooves.push({
        id: 'grv-back',
        name: 'Ranura Fondo Durolac 4mm',
        face: 'face_A',
        x1: pw - 15,
        y1: 0,
        x2: pw - 15,
        y2: pl,
        width: 4,
        depth: 8
      });
    } else {
      // 1.1b Perforaciones de Ensamble para Fondo Trasera de Melamina (18mm / Estructural)
      // Eje a halfThickness del canto posterior (pw - halfThickness)
      // El Fondo Trasera apoya sobre el Piso (descuenta th abajo, y en muebles murales/torres también descuenta th arriba)
      const xBackFix = pw - Math.round(th / 2);
      const backTopY = isBaseOrIsland ? 0 : th;
      const backBottomY = pl - th;
      const backH = backBottomY - backTopY;
      const yFixPairs = backH <= 900
        ? [
            { yBolt: backTopY + 80, yDowel: backTopY + 112 },
            { yBolt: backBottomY - 80, yDowel: backBottomY - 112 }
          ]
        : [
            { yBolt: backTopY + 80, yDowel: backTopY + 112 },
            { yBolt: backTopY + Math.round(backH * 0.5) - 16, yDowel: backTopY + Math.round(backH * 0.5) + 16 },
            { yBolt: backBottomY - 80, yDowel: backBottomY - 112 }
          ];

      yFixPairs.forEach((pair, idx) => {
        if (assemblyType === 'minifix') {
          // Perno Minifix Ø8
          drills.push({
            id: `dr-minifix-lat-back-${idx}`,
            type: 'minifix_bolt_8',
            face: 'face_A',
            x: xBackFix,
            y: pair.yBolt,
            diameter: 8,
            depth: 11,
            label: hardwareBrand === 'Hafele' ? 'Perno Häfele Minifix Fondo Ø8' : 'Perno Minifix Fondo Ø8'
          });
          // Tarugo Guía de Madera Ø8x30 a paso 32mm
          drills.push({
            id: `dr-dowel-lat-back-${idx}`,
            type: 'dowel_8',
            face: 'face_A',
            x: xBackFix,
            y: pair.yDowel,
            diameter: 8,
            depth: 11,
            label: 'Tarugo Guía Fondo Ø8x30'
          });
        } else {
          drills.push({
            id: `dr-spax-lat-back-${idx}-1`,
            type: 'screw_confirmat_5',
            face: 'face_A',
            x: xBackFix,
            y: pair.yBolt,
            diameter: 5,
            depth: th,
            label: 'Perforación Pasante Spax Fondo Ø5'
          });
          drills.push({
            id: `dr-spax-lat-back-${idx}-2`,
            type: 'screw_confirmat_5',
            face: 'face_A',
            x: xBackFix,
            y: pair.yDowel,
            diameter: 5,
            depth: th,
            label: 'Perforación Pasante Spax Fondo Ø5'
          });
        }
      });
    }

    // 1.2 Ensamble con Piso y Techo (Sistema Minifix o Spax)
    if (assemblyType === 'minifix') {
      const isHospital3Drawers = cab?.variant === 'hospital_meson_3drawers';
      const isHospitalModule = cab?.variant === 'hospital_meson_3drawers' || cab?.variant === 'hospital_meson_1door' || cab?.variant === 'hospital_meson_2doors' || cab?.variant === 'hospital_niche_open';
      const topOffsetFront = isHospital3Drawers ? th : 0;
      const topDepth = isHospitalModule
        ? (pw - (isHospital3Drawers ? 2 * th : th))
        : (hasDurolacBack ? pw : pw - th);

      // Ensamble Superior (Tapa Superior / Techo) coordinado milimétricamente con topDepth
      const yTop = Math.round(th / 2);
      drills.push({
        id: `dr-minifix-lat-top-front`,
        type: 'minifix_bolt_8',
        face: 'face_A',
        x: topOffsetFront + 34,
        y: yTop,
        diameter: 8,
        depth: 11,
        label: hardwareBrand === 'Hafele' ? 'Perno Häfele Minifix Ø8' : 'Perno Minifix Ø8'
      });
      drills.push({
        id: `dr-dowel-lat-top-front`,
        type: 'dowel_8',
        face: 'face_A',
        x: topOffsetFront + 66,
        y: yTop,
        diameter: 8,
        depth: 11,
        label: 'Tarugo Guía Ø8x30'
      });
      drills.push({
        id: `dr-minifix-lat-top-rear`,
        type: 'minifix_bolt_8',
        face: 'face_A',
        x: topOffsetFront + (topDepth - 50),
        y: yTop,
        diameter: 8,
        depth: 11,
        label: hardwareBrand === 'Hafele' ? 'Perno Häfele Minifix Ø8' : 'Perno Minifix Ø8'
      });
      drills.push({
        id: `dr-dowel-lat-top-rear`,
        type: 'dowel_8',
        face: 'face_A',
        x: topOffsetFront + (topDepth - 82),
        y: yTop,
        diameter: 8,
        depth: 11,
        label: 'Tarugo Guía Ø8x30'
      });

      if (isHospital3Drawers) {
        drills.push({
          id: `dr-minifix-lat-top-frontbar`,
          type: 'minifix_bolt_8',
          face: 'face_A',
          x: Math.round(th / 2),
          y: yTop,
          diameter: 8,
          depth: 11,
          label: 'Perno Minifix Barra Frontal Ø8'
        });
      }

      // Ensamble Inferior (Piso) a y = pl - th / 2
      const yBot = Math.round(pl - th / 2);
      drills.push({
        id: `dr-minifix-lat-bot-front`,
        type: 'minifix_bolt_8',
        face: 'face_A',
        x: 34,
        y: yBot,
        diameter: 8,
        depth: 11,
        label: hardwareBrand === 'Hafele' ? 'Perno Häfele Minifix Ø8' : 'Perno Minifix Ø8'
      });
      drills.push({
        id: `dr-dowel-lat-bot-front`,
        type: 'dowel_8',
        face: 'face_A',
        x: 66,
        y: yBot,
        diameter: 8,
        depth: 11,
        label: 'Tarugo Guía Ø8x30'
      });
      drills.push({
        id: `dr-minifix-lat-bot-rear`,
        type: 'minifix_bolt_8',
        face: 'face_A',
        x: pw - 50,
        y: yBot,
        diameter: 8,
        depth: 11,
        label: hardwareBrand === 'Hafele' ? 'Perno Häfele Minifix Ø8' : 'Perno Minifix Ø8'
      });
      drills.push({
        id: `dr-dowel-lat-bot-rear`,
        type: 'dowel_8',
        face: 'face_A',
        x: pw - 82,
        y: yBot,
        diameter: 8,
        depth: 11,
        label: 'Tarugo Guía Ø8x30'
      });
    } else {
      // Spax pasante Ø5 mm a 50 mm de los cantos
      [Math.round(th / 2), Math.round(pl - th / 2)].forEach((yRef, idx) => {
        [50, pw - 50].forEach((xPos, xIdx) => {
          drills.push({
            id: `dr-spax-lat-${idx}-${xIdx}`,
            type: 'screw_confirmat_5',
            face: 'face_A',
            x: xPos,
            y: yRef,
            diameter: 5,
            depth: th,
            label: 'Perforación Pasante Spax Ø5'
          });
        });
      });
    }

    // 1.3 Contraplacas de Bisagras (para muebles con puertas)
    const hasDoors = isCabinetWithDoors(cab);
    if (hasDoors && cab) {
      // Contraplaca Häfele / Estándar: a 37 mm del canto FRONTAL (x = 37)
      const hingeX = 37;
      const hingePositionsCm = getCabinetHingesPositions(cab);

      hingePositionsCm.forEach((yPosCm, hIdx) => {
        const yHinge = Math.round(yPosCm * 10);
        if (yHinge > 20 && yHinge < pl - 20) {
          // Cada contraplaca lleva 2 agujeros distanciados 32 mm en vertical (Sistema 32)
          drills.push({
            id: `dr-hinge-plate-${hIdx}-1`,
            type: 'hinge_plate_5',
            face: 'face_A',
            x: hingeX,
            y: yHinge - 16,
            diameter: 5,
            depth: 11,
            label: hardwareBrand === 'Hafele' ? 'Base Bisagra Häfele Metalla Ø5' : 'Base Bisagra Ø5'
          });
          drills.push({
            id: `dr-hinge-plate-${hIdx}-2`,
            type: 'hinge_plate_5',
            face: 'face_A',
            x: hingeX,
            y: yHinge + 16,
            diameter: 5,
            depth: 11,
            label: hardwareBrand === 'Hafele' ? 'Base Bisagra Häfele Metalla Ø5' : 'Base Bisagra Ø5'
          });
        }
      });
    }

    // 1.4 Soportes de Repisas Regulables (Pitones Ø5 mm)
    if (cab) {
      let shelfElevations = getResolvedCabinetShelfElevations(cab, th / 10);
      if ((!shelfElevations || shelfElevations.length === 0) && (cab.shelvesCount || cab.variant === 'hospital_niche_open')) {
        const count = cab.shelvesCount !== undefined ? cab.shelvesCount : 1;
        const step = (pl - 2 * th) / (count + 1);
        shelfElevations = [];
        for (let i = 0; i < count; i++) {
          shelfElevations.push(Math.round(th + (i + 1) * step) / 10);
        }
      }
      if (shelfElevations && shelfElevations.length > 0) {
        const xFront = 37;
        const xRear = pw - 50;

        shelfElevations.forEach((elevCm, sIdx) => {
          const yShelf = Math.round(elevCm * 10);
          if (yShelf > 30 && yShelf < pl - 30) {
            // Grupo de 3 perforaciones a paso 64mm por punto de apoyo (central, -64mm, +64mm)
            [-64, 0, 64].forEach((offsetY, pIdx) => {
              const yHole = yShelf + offsetY;
              if (yHole > 20 && yHole < pl - 20) {
                // Perforación frontal
                drills.push({
                  id: `dr-shelf-${sIdx}-front-${pIdx}`,
                  type: 'shelf_pin_5',
                  face: 'face_A',
                  x: xFront,
                  y: yHole,
                  diameter: 5,
                  depth: 11,
                  label: `Soporte Repisa Ø5 (Frontal ${offsetY === 0 ? 'Centro' : (offsetY > 0 ? `+${offsetY}` : offsetY)})`
                });
                // Perforación posterior
                drills.push({
                  id: `dr-shelf-${sIdx}-rear-${pIdx}`,
                  type: 'shelf_pin_5',
                  face: 'face_A',
                  x: xRear,
                  y: yHole,
                  diameter: 5,
                  depth: 11,
                  label: `Soporte Repisa Ø5 (Posterior ${offsetY === 0 ? 'Centro' : (offsetY > 0 ? `+${offsetY}` : offsetY)})`
                });
              }
            });
          }
        });
      }
    }

    // 1.5 Perforaciones para Correderas Ocultas (Häfele Matrix Runner / Provelcar)
    const isDrawerCab = cab && (cab.variant === '4_drawers' || cab.variant === '2_pot_drawers' || cab.variant === '1_door_1_drawer' || cab.variant === 'tall_inner_drawers');
    if (isDrawerCab && cab) {
      const drawerCount = cab.variant === '4_drawers' ? 4 : cab.variant === '2_pot_drawers' ? 2 : cab.variant === 'tall_inner_drawers' ? 4 : 1;
      const drawerPitch = Math.round((pl - 40) / drawerCount);
      const slideX1 = 37; // Primera fijación a 37 mm del frente
      const slideX2 = 37 + 192; // Segunda fijación a 37 + 192 mm (múltiplo 32)
      const slideX3 = 37 + 288; // Tercera fijación a 37 + 288 mm

      for (let d = 0; d < drawerCount; d++) {
        const slideY = Math.round(25 + d * drawerPitch);
        [slideX1, slideX2, slideX3].forEach((sx, sIdx) => {
          if (sx < pw - 40) {
            drills.push({
              id: `dr-slide-${d}-${sIdx}`,
              type: 'slide_hole_5',
              face: 'face_A',
              x: sx,
              y: slideY,
              diameter: 5,
              depth: 12,
              label: hardwareBrand === 'Hafele' ? 'Guía Häfele Matrix Runner Ø5' : 'Guía Corredera Oculta Ø5'
            });
          }
        });
      }
    }

    // 1.6 Destajes Paramétricos Perfil Gola
    if ((golaSystem === 'aluminum' || golaSystem === 'black') && isBaseOrIsland) {
      // Destaje Gola L Superior: 58mm x 26mm en la esquina superior frontal (x = 0 a 26, y = pl - 58 a pl)
      pockets.push({
        id: 'pkt-gola-l',
        name: 'Destaje CNC Riel Gola L (58x26mm)',
        x: 0,
        y: pl - 58,
        width: 26,
        height: 58,
        depth: th
      });

      // Destaje Gola C Intermedio para cajones (68mm x 26mm)
      const hasGolaC = cab && (cab.variant === '1_door_1_drawer' || cab.variant === '2_pot_drawers' || cab.variant === '4_drawers');
      if (hasGolaC) {
        const golaCY = Math.round(pl * 0.65);
        pockets.push({
          id: 'pkt-gola-c',
          name: 'Destaje CNC Riel Gola C (68x26mm)',
          x: 0,
          y: golaCY - 34,
          width: 26,
          height: 68,
          depth: th
        });
      }
    }
  }

  // 2. PUERTAS BATIENTES
  if (isDoor) {
    // Cazoletas de bisagra Ø35 mm x 12.5 mm a 21.5 mm del borde
    // Häfele Metalla 310 / 500 estándar
    const hingeX = 21.5;
    const hingeYs: number[] = [100, pl - 100];
    if (pl >= 950) hingeYs.push(Math.round(pl / 2));
    if (pl >= 1600) hingeYs.push(Math.round(pl * 0.25), Math.round(pl * 0.75));

    hingeYs.forEach((yHinge, hIdx) => {
      drills.push({
        id: `dr-hinge-cup-${hIdx}`,
        type: 'hinge_cup_35',
        face: 'face_A',
        x: hingeX,
        y: yHinge,
        diameter: 35,
        depth: 12.5,
        label: hardwareBrand === 'Hafele' ? 'Cazoleta Häfele Metalla Ø35mm' : 'Cazoleta Bisagra Ø35mm'
      });
      // Perforaciones para tornillos de fijación de cazoleta (paso 45mm o 48mm entre centros, a 9.5mm de distancia)
      drills.push({
        id: `dr-hinge-screw-${hIdx}-1`,
        type: 'slide_hole_5',
        face: 'face_A',
        x: hingeX + 9.5,
        y: yHinge - 22.5,
        diameter: 2.5,
        depth: 10,
        label: 'Tornillo Cazoleta Ø2.5'
      });
      drills.push({
        id: `dr-hinge-screw-${hIdx}-2`,
        type: 'slide_hole_5',
        face: 'face_A',
        x: hingeX + 9.5,
        y: yHinge + 22.5,
        diameter: 2.5,
        depth: 10,
        label: 'Tornillo Cazoleta Ø2.5'
      });
    });

    // Perforaciones para Tirador (lado opuesto a bisagras si no hay gola y requiere taladros pasantes)
    if (golaSystem === 'none' && handleConfig && handleConfig.model !== 'none') {
      const isSingleHole = handleConfig.model === 'balin' || handleConfig.model === 'berlin';
      const isRearPestana = handleConfig.model === 'ce' || handleConfig.model === 'oslo' || handleConfig.model === 'kutz_asa';
      const handleX = pw - 45;
      const handleCenterY = 70;

      if (!isRearPestana) {
        if (isSingleHole) {
          drills.push({
            id: 'dr-handle-0',
            type: 'handle_hole',
            face: 'face_A',
            x: handleX,
            y: handleCenterY,
            diameter: 4.5,
            depth: th,
            label: `Tirador Ø4.5mm Pasante (${handleConfig.model.toUpperCase()})`
          });
        } else {
          const hLen = handleConfig.lengthMm || 128;
          [handleCenterY, handleCenterY + hLen].forEach((yPos, hIdx) => {
            drills.push({
              id: `dr-handle-${hIdx}`,
              type: 'handle_hole',
              face: 'face_A',
              x: handleX,
              y: yPos,
              diameter: 4.5,
              depth: th,
              label: `Tirador 2x Ø4.5mm Pasante (${handleConfig.model.toUpperCase()} ${hLen}mm)`
            });
          });
        }
      }
    }
  }

  // 3. PISOS, TECHOS Y BARRAS DE AMARRE HORIZONTALES
  if (isPiso || isTecho || isRepisa) {
    // Ranura posterior coincidente para el fondo (solo si usa fondo delgado Durolac y no es barra frontal)
    if (!isRepisa && hasDurolacBack && !nameLower.includes('frontal')) {
      grooves.push({
        id: 'grv-back-horiz',
        name: 'Ranura Fondo Durolac 4mm',
        face: 'face_A',
        x1: pw - 15,
        y1: 0,
        x2: pw - 15,
        y2: pl,
        width: 4,
        depth: 8
      });
    }

    if (assemblyType === 'minifix' && !isRepisa) {
      const isNarrowBar = isBarra || pw < 280;
      const xPairs = isNarrowBar
        ? (pw < 80 ? [{ xBolt: Math.round(pw / 2), xDowel: -1 }] : [{ xBolt: 34, xDowel: 66 }])
        : [
            { xBolt: 34, xDowel: 66 },
            { xBolt: pw - 50, xDowel: pw - 82 }
          ];

      // Cajas de excéntrica Minifix Ø15 mm x 12.5 mm a 34 mm de los cantos de unión con laterales (y = 34 y y = pl - 34)
      // y Tarugos Ø8x30 en los cantos de unión (y = 0 e y = pl) a 32 mm del perno
      [
        { yBox: 34, yEdge: 0, edgeFace: 'edge_W1' as const },
        { yBox: pl - 34, yEdge: pl, edgeFace: 'edge_W2' as const }
      ].forEach((side, yIdx) => {
        xPairs.forEach((pair, xIdx) => {
          drills.push({
            id: `dr-minifix-box-${yIdx}-${xIdx}`,
            type: 'minifix_15',
            face: 'face_A',
            x: pair.xBolt,
            y: side.yBox,
            diameter: 15,
            depth: 12.5,
            label: hardwareBrand === 'Hafele' ? 'Caja Excéntrica Häfele Minifix 15' : 'Caja Excéntrica Minifix Ø15'
          });
          if (pair.xDowel > 0 && pw >= 85) {
            drills.push({
              id: `dr-dowel-horiz-${yIdx}-${xIdx}`,
              type: 'dowel_8',
              face: side.edgeFace,
              x: pair.xDowel,
              y: side.yEdge,
              diameter: 8,
              depth: 20,
              label: 'Tarugo Guía Canto Ø8x30'
            });
          }
        });
      });
      // Tarugos guía de ensamble estructural Piso - Trasera de melamina 18mm
      if (isPiso && !hasDurolacBack && pl >= 300) {
        [Math.round(pl * 0.33), Math.round(pl * 0.67)].forEach((yDowelPos, dIdx) => {
          drills.push({
            id: `dr-dowel-piso-back-${dIdx}`,
            type: 'dowel_8',
            face: 'edge_L2',
            x: pw,
            y: yDowelPos,
            diameter: 8,
            depth: 20,
            label: 'Tarugo Guía Canto Posterior a Trasera Ø8x30'
          });
        });
      }
    }
  }

  // 4. FRENTES DE CAJÓN
  if (isDrawerFront) {
    // Enganche frontal para corredera oculta Häfele Matrix / Provelcar
    // 2 agujeros Ø2.5 / Ø4 para clip de enganche a 25 mm de los bordes laterales y a 15 mm de la base
    [25, pw - 25].forEach((xPos, xIdx) => {
      drills.push({
        id: `dr-drawer-clip-${xIdx}`,
        type: 'slide_hole_5',
        face: 'face_A',
        x: xPos,
        y: 15,
        diameter: 3.5,
        depth: 10,
        label: hardwareBrand === 'Hafele' ? 'Clip de Enganche Häfele Matrix' : 'Clip de Regulación Cajón'
      });
    });

    // Perforaciones y Fresados para Tirador en Frente de Cajón
    if (golaSystem === 'none' && handleConfig && handleConfig.model !== 'none') {
      if (handleConfig.model === 'kutz_asa') {
        // Mecanizado de Rebaje 2mm x 15mm en cara posterior superior según Detalle D1
        pockets.push({
          id: 'pocket-kutz-rebaje-cajon',
          name: 'Rebaje 2mm x 15mm para Perfil KUTZ (Detalle D1)',
          x: 0,
          y: pl - 15,
          width: pw,
          height: 15,
          depth: 2
        });
      } else {
        const isSingleHole = handleConfig.model === 'balin' || handleConfig.model === 'berlin';
        const isRearPestana = handleConfig.model === 'ce' || handleConfig.model === 'oslo';
        const cy = pl / 2;

        if (!isRearPestana) {
          if (isSingleHole) {
            drills.push({
              id: 'dr-drawer-handle-0',
              type: 'handle_hole',
              face: 'face_A',
              x: pw / 2,
              y: cy,
              diameter: 4.5,
              depth: th,
              label: `Tirador Cajón Ø4.5mm Pasante (${handleConfig.model.toUpperCase()})`
            });
          } else {
            const hLen = handleConfig.lengthMm || 128;
            if (pw >= hLen + 40) {
              [pw / 2 - hLen / 2, pw / 2 + hLen / 2].forEach((xPos, hIdx) => {
                drills.push({
                  id: `dr-drawer-handle-${hIdx}`,
                  type: 'handle_hole',
                  face: 'face_A',
                  x: xPos,
                  y: cy,
                  diameter: 4.5,
                  depth: th,
                  label: `Tirador Cajón 2x Ø4.5mm Pasante (${handleConfig.model.toUpperCase()} ${hLen}mm)`
                });
              });
            }
          }
        }
      }
    }
  }

  // 5. FONDO TRASERA DE MELAMINA (18mm / Estructural)
  const isBackSolid = isBack && th > 4;
  if (isBackSolid) {
    const yBackPairs = pl <= 900
      ? [
          { yBolt: 80, yDowel: 112 },
          { yBolt: pl - 80, yDowel: pl - 112 }
        ]
      : [
          { yBolt: 80, yDowel: 112 },
          { yBolt: Math.round(pl * 0.5) - 16, yDowel: Math.round(pl * 0.5) + 16 },
          { yBolt: pl - 80, yDowel: pl - 112 }
        ];

    if (assemblyType === 'minifix') {
      yBackPairs.forEach((pair, idx) => {
        // Canto Izquierdo: Caja Minifix en cara a 34mm y barreno de tarugo en el canto (x = 0)
        drills.push({
          id: `dr-minifix-back-L-${idx}`,
          type: 'minifix_15',
          face: 'face_A',
          x: 34,
          y: pair.yBolt,
          diameter: 15,
          depth: 12.5,
          label: hardwareBrand === 'Hafele' ? 'Caja Excéntrica Häfele Minifix 15' : 'Caja Excéntrica Minifix Ø15'
        });
        drills.push({
          id: `dr-dowel-back-L-${idx}`,
          type: 'dowel_8',
          face: 'edge_L1',
          x: 0,
          y: pair.yDowel,
          diameter: 8,
          depth: 20,
          label: 'Tarugo Guía Canto Ø8x30'
        });

        // Canto Derecho: Caja Minifix en cara a pw - 34mm y barreno de tarugo en el canto (x = pw)
        drills.push({
          id: `dr-minifix-back-R-${idx}`,
          type: 'minifix_15',
          face: 'face_A',
          x: pw - 34,
          y: pair.yBolt,
          diameter: 15,
          depth: 12.5,
          label: hardwareBrand === 'Hafele' ? 'Caja Excéntrica Häfele Minifix 15' : 'Caja Excéntrica Minifix Ø15'
        });
        drills.push({
          id: `dr-dowel-back-R-${idx}`,
          type: 'dowel_8',
          face: 'edge_L2',
          x: pw,
          y: pair.yDowel,
          diameter: 8,
          depth: 20,
          label: 'Tarugo Guía Canto Ø8x30'
        });
      });

      // Tarugos guía de ensamble estructural en canto inferior hacia Piso
      if (pw >= 300) {
        [Math.round(pw * 0.33), Math.round(pw * 0.67)].forEach((xDowelPos, dIdx) => {
          drills.push({
            id: `dr-dowel-back-to-piso-${dIdx}`,
            type: 'dowel_8',
            face: 'edge_W2',
            x: xDowelPos,
            y: 0,
            diameter: 8,
            depth: 20,
            label: 'Tarugo Guía Canto Inferior a Piso Ø8x30'
          });
        });
      }
    }
  }

  // Identificador de pieza estandarizado
  const moduleTag = cab ? (cab.type === 'wall' ? 'A' : cab.type === 'tall' ? 'T' : cab.type === 'island' ? 'I' : 'B') : 'M';
  const partCode = `${moduleTag}-${(part.moduleIndex || 0) + 1}.${part.name.substring(0, 3).toUpperCase()}`;

  return {
    partCode,
    partName: part.name,
    moduleTag: `${moduleTag}-${(part.moduleIndex || 0) + 1}`,
    moduleName: cab ? `${cab.type.toUpperCase()} ${cab.width * 10}x${cab.height * 10}mm` : 'Módulo Cocina',
    width: pw,
    length: pl,
    thickness: th,
    material: part.material || 'Melamina 15mm',
    grainDirection: part.grainDirection || 'vertical',
    edgeL1: !!part.edgeL1,
    edgeL2: !!part.edgeL2,
    edgeW1: !!part.edgeW1,
    edgeW2: !!part.edgeW2,
    edgeThicknessL1: part.edgeL1 ? (isDoor || isDrawerFront ? 2.0 : 0.45) : 0,
    edgeThicknessL2: part.edgeL2 ? (isDoor || isDrawerFront ? 2.0 : 0.45) : 0,
    edgeThicknessW1: part.edgeW1 ? (isDoor || isDrawerFront ? 2.0 : 0.45) : 0,
    edgeThicknessW2: part.edgeW2 ? (isDoor || isDrawerFront ? 2.0 : 0.45) : 0,
    notes: part.notes || '',
    drills,
    grooves,
    pockets
  };
}
