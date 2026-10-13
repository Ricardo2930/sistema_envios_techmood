/**
 * Extrae el nombre de la agencia para Shalom según la regla:
 * Desde la última barra lateral inclinada '/' hacia la derecha, sin espacios sobrantes.
 * Ej: "Cajamarca / Jaen / Jaen / Jaen Co" -> "JAEN CO"
 */
export const extraerDestinoShalom = (agenciaNombre) => {
  if (!agenciaNombre) return '';
  const partes = agenciaNombre.split('/');
  const ultimaParte = partes[partes.length - 1];
  return ultimaParte.trim().toUpperCase();
};

/**
 * Genera y descarga el archivo Excel oficial para carga masiva en Shalom Pro
 * utilizando la plantilla Formato-Pro-Masivo.
 *
 * @param {Array} pedidosShalom - Lista de pedidos con courier Shalom pendientes de guía
 */
export const descargarExcelMasivoShalom = async (pedidosShalom) => {
  if (!pedidosShalom || pedidosShalom.length === 0) {
    throw new Error('No hay pedidos de Shalom disponibles para exportar.');
  }

  // Carga diferida de ExcelJS bajo demanda (reduce el bundle inicial en ~1.5 MB)
  const excelModule = await import('exceljs');
  const ExcelJS = excelModule.default || excelModule;

  // 1. Cargar la plantilla oficial desde /public
  const resp = await fetch('/Formato-Pro-Masivo-2026_10_08_21.xlsx');
  if (!resp.ok) {
    throw new Error('No se pudo cargar la plantilla oficial de Shalom Pro.');
  }
  const arrayBuffer = await resp.arrayBuffer();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);

  const ws = wb.getWorksheet('Hoja1');
  if (!ws) {
    throw new Error('No se encontró la hoja principal "Hoja1" en la plantilla.');
  }

  // 2. Limpiar estilos erróneos de la cabecera (Fila 1) para que no salga tachado ni en cursiva
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      italic: false,
      strike: false,
      underline: false,
      color: { argb: 'FFFFFFFF' }
    };
  });
  headerRow.commit();

  // 3. Limpiar las filas de ejemplo de la plantilla (filas 2 a 50)
  for (let r = 2; r <= 50; r++) {
    const row = ws.getRow(r);
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'].forEach((col) => {
      row.getCell(col).value = null;
    });
    row.commit();
  }

  // 4. Escribir cada pedido en su fila correspondiente con fuente limpia regular
  pedidosShalom.forEach((p, index) => {
    const r = index + 2;
    const row = ws.getRow(r);

    const dni = p.dni_cliente ? String(p.dni_cliente).trim() : '';
    const tel = p.telefono_cliente ? String(p.telefono_cliente).replace(/\D/g, '').replace(/^51/, '').trim() : '';
    const destino = extraerDestinoShalom(p.agencia_nombre);
    const mercaderia = p.tipo_mercaderia || 'PAQUETE XS';

    row.getCell('A').value = dni;
    row.getCell('B').value = tel;
    row.getCell('C').value = '';
    row.getCell('D').value = '';
    row.getCell('E').value = '';
    row.getCell('F').value = 'AV JOSE LEAL CDRA 6'; // Origen por defecto solicitado
    row.getCell('G').value = destino;
    row.getCell('H').value = mercaderia;

    // Fórmulas oficiales de Shalom para dimensiones y peso en función de la mercadería (Columna H)
    row.getCell('I').value = {
      formula: `IF(H${r}="SOBRE",0.1,IF(H${r}="PAQUETE XXS",0.15,IF(H${r}="PAQUETE XS",0.2,IF(H${r}="PAQUETE S",0.3,IF(H${r}="PAQUETE M",0.3,IF(H${r}="PAQUETE L",0.42,""))))))`
    };
    row.getCell('J').value = {
      formula: `IF(H${r}="SOBRE",0.1,IF(H${r}="PAQUETE XXS",0.1,IF(H${r}="PAQUETE XS",0.15,IF(H${r}="PAQUETE S",0.3,IF(H${r}="PAQUETE M",0.24,IF(H${r}="PAQUETE L",0.3,""))))))`
    };
    row.getCell('K').value = {
      formula: `IF(H${r}="SOBRE",0.15,IF(H${r}="PAQUETE XXS",0.1,IF(H${r}="PAQUETE XS",0.12,IF(H${r}="PAQUETE S",0.12,IF(H${r}="PAQUETE M",0.2,IF(H${r}="PAQUETE L",0.23,""))))))`
    };
    row.getCell('L').value = {
      formula: `IF(H${r}="SOBRE",0,IF(H${r}="PAQUETE XXS",0.25,IF(H${r}="PAQUETE XS",0.5,IF(H${r}="PAQUETE S",2,IF(H${r}="PAQUETE M",5,IF(H${r}="PAQUETE L",10,""))))))`
    };

    row.getCell('M').value = 1; // Cantidad
    row.getCell('N').value = '';

    // Reset explícito de fuente: texto normal, no tachado, no cursiva, no negrita
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'].forEach((col) => {
      row.getCell(col).font = {
        name: 'Calibri',
        size: 11,
        bold: false,
        italic: false,
        strike: false,
        underline: false,
        color: { argb: 'FF000000' }
      };
    });

    row.commit();
  });

  // 4. Generar buffer y forzar descarga en el navegador
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const hoy = new Date();
  const fechaStr = `${hoy.getFullYear()}_${String(hoy.getMonth() + 1).padStart(2, '0')}_${String(hoy.getDate()).padStart(2, '0')}`;
  a.download = `Formato-Pro-Masivo-${fechaStr}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return true;
};
