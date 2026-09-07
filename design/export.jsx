// Photoshop の「ファイル > スクリプト > 参照」から実行。
(function () {
  var dir = new File($.fileName).parent;
  var doc = app.open(new File(dir + '/ogp.psd'));
  var output = doc.duplicate('MornXReference export', false);
  var png = new PNGSaveOptions();
  try {
    output.saveAs(new File(dir + '/thumbnail.png'), png, true, Extension.LOWERCASE);
    output.resizeImage(UnitValue(1200, 'px'), UnitValue(675, 'px'));
    output.resizeCanvas(UnitValue(1200, 'px'), UnitValue(630, 'px'), AnchorPosition.MIDDLECENTER);
    output.saveAs(new File(dir + '/ogp.png'), png, true, Extension.LOWERCASE);
  } finally {
    output.close(SaveOptions.DONOTSAVECHANGES);
  }
}());
