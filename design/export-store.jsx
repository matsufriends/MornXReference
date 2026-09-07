// Photoshop の「ファイル > スクリプト > 参照」から実行。
(function () {
  var dir = new File($.fileName).parent;
  var source = app.open(new File(dir + '/ogp.png'));
  var doc = source.duplicate('ストア用サムネイル', false);
  var background = app.backgroundColor;
  try {
    app.activeDocument = doc;
    var cream = new SolidColor(); cream.rgb.hexValue = 'FFFEF7'; app.backgroundColor = cream;
    doc.resizeImage(UnitValue(440, 'px'));
    doc.resizeCanvas(UnitValue(440, 'px'), UnitValue(280, 'px'), AnchorPosition.MIDDLECENTER);
    doc.flatten();
    doc.saveAs(new File(dir + '/../docs/thumbnail.png'), new PNGSaveOptions(), true, Extension.LOWERCASE);
  } finally {
    doc.close(SaveOptions.DONOTSAVECHANGES);
    app.backgroundColor = background;
  }
}());
