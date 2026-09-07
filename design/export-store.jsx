// Photoshop の「ファイル > スクリプト > 参照」から実行。
(function () {
  var dir = new File($.fileName).parent;
  var store = new Folder(dir + '/../docs/store');
  var source = app.open(new File(dir + '/ogp.psd'));
  var doc = source.duplicate('ストア用サムネイル', false);
  app.activeDocument = doc;
  function find(name, layers) {
    layers = layers || doc.layers;
    for (var i = 0; i < layers.length; i++) {
      if (layers[i].name === name) return layers[i];
      if (layers[i].typename === 'LayerSet') { var found = find(name, layers[i].layers); if (found) return found; }
    }
    return null;
  }
  function setText(name, value, size, x, y) {
    var layer = find(name);
    layer.textItem.contents = value;
    layer.textItem.size = size;
    layer.textItem.position = [x, y];
  }
  doc.resizeImage(UnitValue(440, 'px'), UnitValue(280, 'px'));
  find('利用画面').visible = false;
  find('ギャラリー画面（説明用イメージ）').visible = false;
  find('Chrome 拡張 タグ').visible = false;
  find('メディア タグ').visible = false;
  find('Hairline footer').visible = false;
  find('Hairline footer の配色').visible = false;
  find('MornXReference アイコン').visible = false;
  var iconSource = app.open(new File(dir + '/../icons/icon128.png'));
  iconSource.resizeImage(UnitValue(36, 'px'), UnitValue(36, 'px'));
  var icon = iconSource.activeLayer.duplicate(doc, ElementPlacement.PLACEATBEGINNING);
  iconSource.close(SaveOptions.DONOTSAVECHANGES);
  app.activeDocument = doc;
  icon.name = 'MornXReference アイコン';
  icon.translate(28 - icon.bounds[0].as('px'), 28 - icon.bounds[1].as('px'));
  setText('Brand rich', 'MornXReference', 22, 77, 54);
  setText('Hero first', 'Xのブックマークを、', 28, 28, 119);
  setText('Hero second', '一覧で。', 46, 28, 174);
  setText('Copy first', '動画も画像も、まとめて見比べる。', 16, 28, 218);
  setText('Footer studio', 'Chrome 拡張', 13, 28, 252);
  find('Footer studio').textItem.font = 'HiraginoSans-W6';
  doc.saveAs(new File(dir + '/store-promo.psd'), new PhotoshopSaveOptions(), true, Extension.LOWERCASE);
  doc.flatten();
  doc.saveAs(new File(store + '/promo-small.png'), new PNGSaveOptions(), true, Extension.LOWERCASE);
  doc.close(SaveOptions.DONOTSAVECHANGES);
}());
