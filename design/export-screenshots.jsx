// Photoshop の「ファイル > スクリプト > 参照」から実行。
(function () {
  var dir = new File($.fileName).parent;
  var source = app.open(new File(dir + '/ogp.psd'));
  var doc = source.duplicate('ストア用スクリーンショット', false);
  app.activeDocument = doc;
  doc.resizeImage(UnitValue(1280, 'px'), UnitValue(800, 'px'));
  doc.layerSets.getByName('文字・ロゴ').visible = false;
  doc.layerSets.getByName('利用画面').visible = false;
  doc.layerSets.getByName('ギャラリー画面（説明用イメージ）').visible = false;
  doc.artLayers.getByName('MornXReference アイコン').visible = false;
  function color(hex) { var c = new SolidColor(); c.rgb.hexValue = hex; return c; }
  function rect(name, x, y, w, h, hex) {
    var l = doc.artLayers.add(); l.name = name;
    doc.selection.select([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
    doc.selection.fill(color(hex)); doc.selection.deselect();
  }
  function text(name, value, x, y, size, font) {
    var l = doc.artLayers.add(); l.kind = LayerKind.TEXT; l.name = name;
    l.textItem.contents = value; l.textItem.font = font;
    l.textItem.size = size; l.textItem.color = color('46551A'); l.textItem.position = [x,y];
  }
  function place(path, name, x, y, width) {
    var input = app.open(new File(path));
    var l = input.activeLayer.duplicate(doc, ElementPlacement.PLACEATBEGINNING);
    input.close(SaveOptions.DONOTSAVECHANGES); app.activeDocument = doc;
    doc.activeLayer = l;
    executeAction(stringIDToTypeID('newPlacedLayer'), undefined, DialogModes.NO);
    l = doc.activeLayer; l.name = name;
    var scale = width / (l.bounds[2].as('px') - l.bounds[0].as('px')) * 100;
    l.resize(scale, scale);
    l.translate(x - l.bounds[0].as('px'), y - l.bounds[1].as('px'));
  }
  rect('画面枠', 92, 96, 1096, 688, 'D5DDB4');
  place(dir + '/../docs/store/screenshot-1.png', '提供された実画面（ぼかしを保持）', 96, 100, 1088);
  place(dir + '/../icons/icon128.png', 'アプリアイコン', 96, 30, 40);
  text('アプリ名', 'MornXReference', 150, 60, 27, 'HelveticaNeue-Bold');
  text('見出し', 'Xのブックマークを、一覧で。', 760, 60, 22, 'HiraginoSans-W6');
  doc.saveAs(new File(dir + '/store-screenshot.psd'), new PhotoshopSaveOptions(), true, Extension.LOWERCASE);
  doc.flatten();
  doc.saveAs(new File(dir + '/../docs/store/screenshot-gallery.png'), new PNGSaveOptions(), true, Extension.LOWERCASE);
  doc.close(SaveOptions.DONOTSAVECHANGES);
}());
