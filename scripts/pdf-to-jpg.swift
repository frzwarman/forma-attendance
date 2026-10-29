// Renders every page of a PDF to <prefix>-<n>.jpg, 1240 px wide, and prints "pages width height".
// The rundown and the speaker CVs are shown on the attendee page as these images.
// Usage (macOS): swift scripts/pdf-to-jpg.swift input.pdf public/narasumber/agus-canny
import AppKit
import PDFKit

let args = CommandLine.arguments
guard args.count == 3, let pdf = PDFDocument(url: URL(fileURLWithPath: args[1])) else {
  FileHandle.standardError.write("usage: swift scripts/pdf-to-jpg.swift input.pdf output-prefix\n".data(using: .utf8)!)
  exit(1)
}
var size = (0, 0)
for index in 0..<pdf.pageCount {
  let page = pdf.page(at: index)!
  let box = page.bounds(for: .mediaBox)
  let scale = 1240 / box.width
  let width = Int(box.width * scale), height = Int((box.height * scale).rounded())
  let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height, bitsPerSample: 8, samplesPerPixel: 4,
    hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  let context = NSGraphicsContext(bitmapImageRep: bitmap)!.cgContext
  context.setFillColor(NSColor.white.cgColor)
  context.fill(CGRect(x: 0, y: 0, width: width, height: height))
  context.scaleBy(x: scale, y: scale)
  page.draw(with: .mediaBox, to: context)
  let jpg = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.8])!
  try! jpg.write(to: URL(fileURLWithPath: "\(args[2])-\(index + 1).jpg"))
  if index > 0 && size != (width, height) { print("warning: page \(index + 1) is \(width)x\(height)") }
  size = (width, height)
}
print(pdf.pageCount, size.0, size.1)
