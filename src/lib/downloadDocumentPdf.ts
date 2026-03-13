import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

export async function downloadDocumentPdf(
  elementId: string,
  filename: string
) {
  const el = document.getElementById(elementId);
  if (!el) return;

  // Temporarily make the element visible and scrollable for capture
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
    windowWidth: 800,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pdfWidth - 20; // 10mm margin each side
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 10; // top margin

  pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
  heightLeft -= pdfHeight - 20;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight + 10;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight - 20;
  }

  pdf.save(filename);
}
