import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { ClosetModule } from '../store';
import { renderArquifyPdfLogo } from './pdfLogo';
import { getFriendlyColorName } from './colorNames';

export interface ManufacturingData {
  height: number;
  depth: number;
  thickness: number;
  showTopWall: boolean;
  showBottomWall: boolean;
  showLeftWall: boolean;
  showRightWall: boolean;
  showBackWall: boolean;
  showSocle: boolean;
  
  backColor: string;
  doorColor: string;
  drawerHardware?: 'Telescopica' | 'Provelcar' | 'Hafele';
  assemblyType?: 'spax' | 'minifix';
  modules: ClosetModule[];
}

// Parámetros técnicos de herrajes según marca (13 mm por lado para rieles telescópicos = 26 mm de holgura total)
const HARDWARE_SPECS: Record<string, {
  slideClearanceTotal: number;
  slideName: string;
  drawerLengthDeduction: number;
  maxSideThickness: number;
}> = {
  Telescopica: {
    // Riel telescópico estándar: 13 mm a cada lado = 26 mm total
    slideClearanceTotal: 26, 
    slideName: 'Rieles Telescópicos Ext. Total (13mm c/lado)',
    drawerLengthDeduction: 0,
    maxSideThickness: 18
  },
  Provelcar: {
    // Rieles telescópicos Provelcar: 13 mm a cada lado = 26 mm total
    slideClearanceTotal: 26, 
    slideName: 'Rieles Telescópicos Provelcar Ext. Total (13mm c/lado)',
    drawerLengthDeduction: 0,
    maxSideThickness: 18
  },
  Hafele: {
    // Rieles telescópicos Häfele: 13 mm a cada lado = 26 mm total
    slideClearanceTotal: 26, 
    slideName: 'Rieles Telescópicos Häfele Ext. Total (13mm c/lado)',
    drawerLengthDeduction: 0,
    maxSideThickness: 16
  }
};

export interface Part {
  moduleId: string;
  moduleIndex: number;
  name: string;
  qty: number;
  length: number;
  width: number;
  thickness: number;
  material: string;
  edgeL1: boolean;
  edgeL2: boolean;
  edgeW1: boolean;
  edgeW2: boolean;
  notes?: string;
  grainDirection?: 'vertical' | 'horizontal';
  isHpl?: boolean;
  materialCategory?: 'doors' | 'structure' | 'backs' | 'cover';
}

export function getNominalSlideLength(innerDepthMm: number): number {
  const availableNLs = [250, 300, 350, 400, 450, 500, 550];
  // Requerimiento mínimo (LT min = NL + 3). Usaremos +10mm de holgura de seguridad
  for (let i = availableNLs.length - 1; i >= 0; i--) {
    if (availableNLs[i] + 10 <= innerDepthMm) {
      return availableNLs[i];
    }
  }
  return 250; // Fallback mínimo si el mueble es demasiado poco profundo
}

export function generatePartsList(data: ManufacturingData): Part[] {
  const parts: Part[] = [];
  const { thickness, height, depth, modules, showLeftWall, showRightWall, showTopWall, showBottomWall, showBackWall } = data;
  
  const innerHeight = height - (showTopWall ? thickness : 0) - (showBottomWall ? thickness : 0);

  modules.forEach((mod, index) => {
    const innerW = mod.width - (showLeftWall ? thickness : 0) - (showRightWall ? thickness : 0);
    
    const modName = `(Mod ${index+1})`;

    // 1. Laterales (Sides)
    if (showLeftWall || showRightWall) {
      const qty = (showLeftWall ? 1 : 0) + (showRightWall ? 1 : 0);
      parts.push({
        name: `Lateral ${modName}`,
        moduleId: mod.id,
        moduleIndex: index,
        qty,
        length: height * 10,
        width: depth * 10,
        thickness: thickness * 10,
        material: 'Melamina Cuerpo',
        edgeL1: true, edgeL2: false, edgeW1: true, edgeW2: true,
        notes: 'Estructura indep.'
      });
    }

    // 2. Techo y Base (Top/Bottom)
    if (showTopWall || showBottomWall) {
      const qty = (showTopWall ? 1 : 0) + (showBottomWall ? 1 : 0);
      parts.push({
        name: `Techo/Base ${modName}`,
        moduleId: mod.id,
        moduleIndex: index,
        qty,
        length: innerW * 10,
        width: depth * 10,
        thickness: thickness * 10,
        material: 'Melamina Cuerpo',
        edgeL1: true, edgeL2: false, edgeW1: false, edgeW2: false,
        notes: 'Fijación entre lat.'
      });
    }

    // 3. Trasera (Back)
    if (showBackWall) {
      parts.push({
        name: `Trasera ${modName}`,
        moduleId: mod.id,
        moduleIndex: index,
        qty: 1,
        length: innerHeight * 10,
        width: innerW * 10,
        thickness: 3,
        material: 'Melamina Fondo',
        edgeL1: false, edgeL2: false, edgeW1: false, edgeW2: false,
        notes: 'Placa encajada'
      });
    }

    // 4. Repisas y Barra (Shelves and Hanger)
    if (mod.hasHanger) {
      if (mod.shelves > 0) {
        parts.push({
          name: `Maletero ${modName}`,
        moduleId: mod.id,
        moduleIndex: index,
          qty: 1,
          length: innerW * 10,
          width: depth * 10 - (showBackWall ? thickness * 10 : 0),
          thickness: thickness * 10,
          material: 'Melamina Cuerpo',
          edgeL1: true, edgeL2: false, edgeW1: false, edgeW2: false,
        });
        if (mod.shelves > 1) {
          parts.push({
            name: `Repisa Inf. ${modName}`,
        moduleId: mod.id,
        moduleIndex: index,
            qty: 1,
            length: innerW * 10,
            width: depth * 10 - (showBackWall ? thickness * 10 : 0),
            thickness: thickness * 10,
            material: 'Melamina Cuerpo',
            edgeL1: true, edgeL2: false, edgeW1: false, edgeW2: false,
          });
        }
      }
      parts.push({
        name: `Barra Colgar ${modName}`,
        moduleId: mod.id,
        moduleIndex: index,
        qty: 1,
        length: innerW * 10 - 2, // Descuento de holgura
        width: 30, // diámetro tubo mm
        thickness: 15,
        material: 'Tubo Metálico Ovalado',
        edgeL1: false, edgeL2: false, edgeW1: false, edgeW2: false,
        notes: '2 soportes lat.'
      });
    } else if (mod.shelves > 0) {
      parts.push({
        name: `Repisa ${modName}`,
        moduleId: mod.id,
        moduleIndex: index,
        qty: mod.shelves,
        length: innerW * 10,
        width: depth * 10 - (showBackWall ? thickness * 10 : 0),
        thickness: thickness * 10,
        material: 'Melamina Cuerpo',
        edgeL1: true, edgeL2: false, edgeW1: false, edgeW2: false,
      });
    }

    // 5. Cajones (Drawers)
    if (mod.drawers > 0) {
      const isInnerDrawer = mod.doors && mod.innerDrawers;
      const spacerGapMm = isInnerDrawer ? 30 : 0;
      
      // 5.1 Frente de Cajón
      // Si es interior, se hace más bajo para meter la mano (aprox 3cm de holgura). Si es exterior, holgura de 3mm.
      const drawerFrontHeightMm = isInnerDrawer ? (270 - 30) : (270 - 3); 
      // Ancho del frente: interior debe esquivar bisagras, exterior cubre el módulo.
      const drawerFrontWidthMm = isInnerDrawer ? (innerW * 10 - (spacerGapMm * 2) - 4) : (mod.width * 10 - 3);

      parts.push({
        name: `Frente Cajón ${modName}`,
        moduleId: mod.id,
        moduleIndex: index,
        qty: mod.drawers,
        length: drawerFrontWidthMm,
        width: drawerFrontHeightMm,
        thickness: thickness * 10,
        material: 'Melamina Frente Cajón',
        edgeL1: true, edgeL2: true, edgeW1: true, edgeW2: true,
        notes: isInnerDrawer ? 'Tapacanto perimetral (Cajón Int.)' : 'Tapacanto perimetral',
        grainDirection: mod.overrides?.grainDirection || 'vertical'
      });

      // 5.2 Cajón Interior (Cálculo según rieles telescópicos de 13mm a cada lado)
      const hwSpec = HARDWARE_SPECS[data.drawerHardware || 'Telescopica'] || HARDWARE_SPECS.Telescopica;
      // Largo Nominal de la corredera (NL)
      const internalClearanceZ = isInnerDrawer ? (thickness * 10) + 10 : 0; 
      const innerDepthMm = (depth - (showBackWall ? 0.3 : 0)) * 10 - internalClearanceZ;
      const nominalLength = getNominalSlideLength(innerDepthMm);
      
      // Largo exterior real del cajón (SKL)
      const drawerBoxLength = nominalLength - hwSpec.drawerLengthDeduction;

      // Estructura fija para cajón interno
      if (isInnerDrawer) {
        const drawersTotalHeightMm = mod.drawers * 270;
        
        parts.push({
          name: `Lateral Int. Cajonera ${modName}`,
        moduleId: mod.id,
        moduleIndex: index,
          qty: 2,
          length: drawersTotalHeightMm,
          width: drawerBoxLength,
          thickness: thickness * 10,
          material: 'Melamina Cuerpo',
          edgeL1: true, edgeL2: false, edgeW1: false, edgeW2: false,
          notes: 'Lateral continuo int.'
        });
        
        parts.push({
          name: `Pilastra Frontal Cajonera ${modName}`,
        moduleId: mod.id,
        moduleIndex: index,
          qty: 2,
          length: drawersTotalHeightMm,
          width: spacerGapMm,
          thickness: thickness * 10,
          material: 'Melamina Cuerpo',
          edgeL1: true, edgeL2: true, edgeW1: false, edgeW2: false,
          notes: 'Regleta tapa-luz'
        });
      }

      // Ancho exterior del cajón (SKW) = Ancho interno libre (LW) - Holgura rieles telescópicos (13mm c/lado = 26mm total)
      const freeInnerW = isInnerDrawer ? (innerW * 10 - ((spacerGapMm + thickness * 10) * 2)) : (innerW * 10);
      const drawerBoxOuterWidth = freeInnerW - hwSpec.slideClearanceTotal;
      
      // Frente y Trasera interior (va por dentro de los laterales del cajón, descontando el espesor de la melamina del cajón x2)
      const drawerFrontBackLength = drawerBoxOuterWidth - (2 * thickness * 10);
      const drawerSideHeight = 150; // Altura estándar caja interior

      parts.push({
        name: `Lateral Cajón Int. ${modName}`,
        moduleId: mod.id,
        moduleIndex: index,
        qty: mod.drawers * 2,
        length: drawerBoxLength,
        width: drawerSideHeight,
        thickness: thickness * 10,
        material: 'Melamina Cuerpo',
        edgeL1: true, edgeL2: false, edgeW1: false, edgeW2: false,
        notes: `P/ ${hwSpec.slideName} (NL=${nominalLength}mm)`
      });

      parts.push({
        name: `Contrafrente Cajón Int. ${modName}`,
        moduleId: mod.id,
        moduleIndex: index,
        qty: mod.drawers,
        length: drawerFrontBackLength,
        width: drawerSideHeight,
        thickness: thickness * 10,
        material: 'Melamina Cuerpo',
        edgeL1: true, edgeL2: false, edgeW1: false, edgeW2: false,
        notes: `Testero frontal interior (descuenta ${Math.round(thickness * 20)}mm laterales). Ancho ext. caja armada = ${drawerBoxOuterWidth}mm (Rieles 13mm c/lado)`
      });

      parts.push({
        name: `Trasera Cajón Int. ${modName}`,
        moduleId: mod.id,
        moduleIndex: index,
        qty: mod.drawers,
        length: drawerFrontBackLength,
        width: drawerSideHeight,
        thickness: thickness * 10,
        material: 'Melamina Cuerpo',
        edgeL1: true, edgeL2: false, edgeW1: false, edgeW2: false,
        notes: `Testero posterior interior (descuenta ${Math.round(thickness * 20)}mm laterales). Ancho ext. caja armada = ${drawerBoxOuterWidth}mm (Rieles 13mm c/lado)`
      });

      const closetDrawerBottomDepth = drawerBoxLength - (2 * thickness * 10);
      parts.push({
        name: `Fondo Cajón (Melamina ${thickness * 10}mm) ${modName}`,
        moduleId: mod.id,
        moduleIndex: index,
        qty: mod.drawers,
        length: closetDrawerBottomDepth,
        width: drawerFrontBackLength,
        thickness: thickness * 10,
        material: mod.overrides?.drawerInnerColor || (data as any).drawerInnerColor || (data as any).structureColor || 'Melamina Cuerpo',
        edgeL1: false, edgeL2: false, edgeW1: false, edgeW2: false,
        notes: `Fondo melamina ${thickness * 10}mm encajado interior en las 4 caras (${drawerFrontBackLength}x${closetDrawerBottomDepth}mm | caja ext. ${drawerBoxOuterWidth}x${drawerBoxLength}mm)`
      });
    }

    // 6. Puertas (Doors)
    if (mod.doors) {
      const isInnerDrawer = mod.innerDrawers;
      const doorCount = mod.width > 60 ? 2 : 1;
      const doorW = (mod.width - (doorCount > 1 ? 2 : 4)) / doorCount;
      const totalDrawersHeight = (mod.drawers > 0 && !isInnerDrawer) ? mod.drawers * 27 : 0; 
      const doorHeight = height - totalDrawersHeight - (showTopWall ? thickness : 0);

      parts.push({
        name: `Puerta ${modName}`,
        moduleId: mod.id,
        moduleIndex: index,
        qty: doorCount,
        length: doorHeight * 10 - 3,
        width: doorW * 10,
        thickness: thickness * 10,
        material: 'Melamina Frente',
        edgeL1: true, edgeL2: true, edgeW1: true, edgeW2: true,
        notes: 'Tapacanto perimetral',
        grainDirection: mod.overrides?.grainDirection || 'vertical'
      });
    }

    // 7. Zócalos (Socle)
    if (data.showSocle) {
      // Zócalo frontal y trasero por cada módulo (ancho interior)
      parts.push({
        name: `Zócalo Fr/Tr ${modName}`,
        moduleId: mod.id,
        moduleIndex: index,
        qty: 2,
        length: innerW * 10,
        width: 10 * 10, // 10cm baseOffset
        thickness: thickness * 10,
        material: 'Melamina Zócalo',
        edgeL1: true, edgeL2: false, edgeW1: false, edgeW2: false,
        notes: 'Va a piso, tapacanto superior'
      });
    }
  });

  return parts;
}

export function generateEdgeBandingList(parts: Part[], edgeFronts = 2.0, edgeCabinets = 0.45) {
  let edge2mm = 0; // en milímetros
  let edge045mm = 0; // en milímetros

  parts.forEach(part => {
    // Calcular el perímetro de cantos aplicados en la pieza actual
    const partEdgeLength = 
      (part.edgeL1 ? part.length : 0) + 
      (part.edgeL2 ? part.length : 0) + 
      (part.edgeW1 ? part.width : 0) + 
      (part.edgeW2 ? part.width : 0);
    
    const totalEdgeForPart = partEdgeLength * part.qty;

    if (part.material === 'Melamina Frente' || part.material === 'Melamina Frente Cajón') {
      // Puertas y Frentes de Cajón usan tapacanto de frentes
      edge2mm += totalEdgeForPart;
    } else if (part.material === 'Melamina Cuerpo' || part.material === 'Melamina Fondo' || part.material === 'Melamina Zócalo') {
      // Gabinetes y Repisas usan tapacanto de cuerpo
      edge045mm += totalEdgeForPart;
    }
  });

  // Convertir a metros y agregar 10% de margen de pérdida (desperdicio estándar)
  const margin = 1.1;
  const meters2mm = (edge2mm / 1000) * margin;
  const meters045mm = (edge045mm / 1000) * margin;

  const edgeList = [];
  if (meters2mm > 0) {
    edgeList.push({
      Especialidad: 'Insumos',
      Item: `Tapacanto PVC ${edgeFronts.toFixed(2)}mm (Frentes)`,
      Cantidad: Number(meters2mm.toFixed(1)),
      Unidad: 'Metros',
      Notas: 'Incluye 10% desperdicio'
    });
  }
  if (meters045mm > 0) {
    edgeList.push({
      Especialidad: 'Insumos',
      Item: `Tapacanto PVC ${edgeCabinets.toFixed(2)}mm (Cuerpo)`,
      Cantidad: Number(meters045mm.toFixed(1)),
      Unidad: 'Metros',
      Notas: 'Incluye 10% desperdicio'
    });
  }

  return edgeList;
}

export function generateHardwareList(data: ManufacturingData) {
  const hardware: any[] = [];
  let totalDrawers = 0;
  let totalDoors = 0;
  let totalHangers = 0;

  data.modules.forEach(mod => {
    totalDrawers += mod.drawers;
    if (mod.doors) {
      const doorCount = mod.width > 60 ? 2 : 1;
      totalDoors += doorCount;
    }
    if (mod.hasHanger) totalHangers++;
  });

  const hwSpec = HARDWARE_SPECS[data.drawerHardware || 'Provelcar'];
  const innerDepthMm = (data.depth - (data.showBackWall ? 0.3 : 0)) * 10;
  const nominalLength = getNominalSlideLength(innerDepthMm);

  if (totalDrawers > 0) {
    hardware.push({
      Especialidad: 'Quincallería',
      Item: `${hwSpec.slideName} ${nominalLength}mm (NL)`,
      Cantidad: totalDrawers,
      Unidad: 'Pares',
      Ubicación: 'Cajones',
    });
  }

  if (totalDoors > 0) {
    // Cálculo de bisagras (altura define bisagras por puerta)
    const hingesPerDoor = data.height > 200 ? 4 : data.height > 150 ? 3 : 2;
    hardware.push({
      Especialidad: 'Quincallería',
      Item: 'Bisagra Cazoleta 35mm (Cierre Suave)',
      Cantidad: totalDoors * hingesPerDoor,
      Unidad: 'Unidades',
      Ubicación: 'Puertas',
    });
  }

  if (totalHangers > 0) {
    hardware.push({
      Especialidad: 'Quincallería',
      Item: 'Soporte Lateral para Barra Ovalada',
      Cantidad: totalHangers * 2,
      Unidad: 'Unidades',
      Ubicación: 'Barras de Colgar',
    });
  }

  // Elementos generales de armado
  const assemblyMethod = data.assemblyType || 'spax';
  
  if (assemblyMethod === 'spax') {
    hardware.push({
      Especialidad: 'Insumos',
      Item: 'Tornillo Soberbio / Spax 5x50mm',
      Cantidad: data.modules.length * 30, // Estimación
      Unidad: 'Unidades',
      Ubicación: 'Estructura General',
    });
    hardware.push({
      Especialidad: 'Insumos',
      Item: 'Tapas Adhesivas p/Tornillos',
      Cantidad: data.modules.length * 30,
      Unidad: 'Unidades',
      Ubicación: 'Estructura General',
    });
  } else if (assemblyMethod === 'minifix') {
    hardware.push({
      Especialidad: 'Quincallería',
      Item: 'Perno Minifix + Caja Excéntrica 15mm',
      Cantidad: data.modules.length * 24, // Estimación
      Unidad: 'Juegos',
      Ubicación: 'Estructura General (Uniones ocultas)',
    });
    hardware.push({
      Especialidad: 'Insumos',
      Item: 'Tarugo de Madera 8x30mm',
      Cantidad: data.modules.length * 48, // Estimación
      Unidad: 'Unidades',
      Ubicación: 'Estructura General (Guías)',
    });
  }

  return hardware;
}

export function exportToExcel(data: ManufacturingData, filename = 'listado_de_cortes.xlsx') {
  const parts = generatePartsList(data);
  const hardware = generateHardwareList(data);
  const edgeBanding = generateEdgeBandingList(parts);
  
  const wsData = parts.map(p => ({
    Especialidad: 'Carpintería / Muebles',
    Material: p.material,
    Pieza: p.name,
    Cantidad: p.qty,
    'Largo (mm)': p.length.toFixed(1),
    'Ancho (mm)': p.width.toFixed(1),
    'Espesor (mm)': p.thickness.toFixed(1),
    'Tapacanto Largo 1': p.edgeL1 ? 'Sí' : 'No',
    'Tapacanto Largo 2': p.edgeL2 ? 'Sí' : 'No',
    'Tapacanto Ancho 1': p.edgeW1 ? 'Sí' : 'No',
    'Tapacanto Ancho 2': p.edgeW2 ? 'Sí' : 'No',
    Notas: p.notes || ''
  }));

  const ws = XLSX.utils.json_to_sheet(wsData);
  const wsHardware = XLSX.utils.json_to_sheet(hardware);
  const wsEdgeBanding = XLSX.utils.json_to_sheet(edgeBanding);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Despiece Melamina");
  XLSX.utils.book_append_sheet(wb, wsHardware, "Quincallería");
  XLSX.utils.book_append_sheet(wb, wsEdgeBanding, "Tapacantos");
  
  XLSX.writeFile(wb, filename);
}

export function exportToPDF(data: ManufacturingData, filename = 'optimizacion_cortes.pdf') {
  const parts = generatePartsList(data);
  
  // @ts-ignore
  const doc = new jsPDF('landscape', 'mm', 'a4');
  
  renderArquifyPdfLogo(doc, 14, 16, 22);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.text("Plan de Optimización de Cortes - Clóset Modular", 14, 25);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Reporte Técnico & Plan de Fabricación Industrial", 14, 31);
  doc.text("Material Estándar de Placa: 2440 mm x 1830 mm", 14, 36);

  const tableData = parts.map(p => [
    p.name,
    getFriendlyColorName(p.material, (data as any).customTextures),
    p.qty,
    `${p.length.toFixed(1)} x ${p.width.toFixed(1)}`,
    (p.edgeL1 || p.edgeL2 || p.edgeW1 || p.edgeW2) ? 'Perimetral / Seleccionado' : 'Sin Tapacanto'
  ]);

  // @ts-ignore
  doc.autoTable({
    startY: 45,
    head: [['Pieza', 'Material', 'Cant.', 'Dimensiones (L x A) [mm]', 'Tapacantos']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2.2, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 60 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 60, halign: 'center' },
      4: { cellWidth: 50 }
    }
  });

  // @ts-ignore
  let finalY = doc.lastAutoTable.finalY + 20;
  
  if (finalY > 150) {
    doc.addPage();
    finalY = 20;
  }
  
  doc.setFontSize(14);
  doc.text("Esquema de Corte (Pre-visualización Heurística)", 14, finalY);
  
  const scale = 0.08; 
  const boardW = 2440 * scale;
  const boardH = 1830 * scale;
  
  doc.setDrawColor(0);
  doc.setFillColor(230, 230, 230);
  doc.rect(14, finalY + 10, boardW, boardH, 'DF');
  
  let currentX = 14;
  let currentY = finalY + 10;
  let rowHeight = 0;
  
  doc.setFontSize(6);
  
  parts.forEach(p => {
    for (let i = 0; i < p.qty; i++) {
      let pieceW = p.length * scale;
      let pieceH = p.width * scale;
      
      if (pieceW > pieceH && pieceW > (14 + boardW - currentX)) {
        const temp = pieceW;
        pieceW = pieceH;
        pieceH = temp;
      }
      
      if (currentX + pieceW > 14 + boardW) {
        currentX = 14;
        currentY += rowHeight;
        rowHeight = 0;
      }
      
      if (currentY + pieceH <= finalY + 10 + boardH) {
        doc.setFillColor(249, 115, 22);
        doc.rect(currentX, currentY, pieceW - 0.5, pieceH - 0.5, 'DF');
        doc.setTextColor(255);
        
        if (pieceW > 10 && pieceH > 5) {
            doc.text(`${p.name.substring(0, 3)}`, currentX + 2, currentY + 5);
        }
        
        currentX += pieceW;
        if (pieceH > rowHeight) rowHeight = pieceH;
      }
    }
  });

  doc.save(filename);
}
