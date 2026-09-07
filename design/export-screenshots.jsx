// Photoshop の「ファイル > スクリプト > 参照」から実行。
(function () {
  var dir = new File($.fileName).parent;
  var source = app.open(new File(dir + '/screenshot-source.png'));
  var doc = source.duplicate('ストア用スクリーンショット', false);
  app.activeDocument = doc;
  doc.activeLayer.name = '元の実画面（サイドバー・操作欄を保持）';
  var grid = doc.layerSets.add(); grid.name = 'サンプル画像と元ポストリンク';
  function color(hex) { var c = new SolidColor(); c.rgb.hexValue = hex; return c; }
  function polygon(name, points, hex) {
    var layer = grid.artLayers.add(); layer.name = name; doc.activeLayer = layer;
    doc.selection.select(points); doc.selection.fill(color(hex)); doc.selection.deselect();
  }
  function rect(name, x, y, w, h, hex) {
    polygon(name, [[x,y],[x+w,y],[x+w,y+h],[x,y+h]], hex);
  }
  function link(x, y, index) {
    var layer = grid.artLayers.add(); layer.kind = LayerKind.TEXT; layer.name = '元ポスト ' + index;
    layer.textItem.contents = '元ポスト'; layer.textItem.font = 'HiraginoSans-W3';
    layer.textItem.size = 12; layer.textItem.color = color('1D9BF0'); layer.textItem.position = [x,y];
    rect('リンク下線 ' + index, x, y + 2, 48, 1, '1D9BF0');
  }
  // 変更範囲は右側のグリッド内だけ。見出しや外枠は追加しない。
  rect('グリッド背景', 254, 38, 1026, 762, 'FFFFFF');
  var palettes = [
    ['EDEEA9','B0C56E','718B22'], ['DFE9E6','92BCB0','507E72'],
    ['F0E4C3','D1B879','A17E3F'], ['E5E3F1','B7AED5','8779AE'],
    ['E0E9CD','AFC77E','779B47'], ['F1E0D9','D6AD98','AC7862']
  ];
  for (var i = 0; i < 15; i++) {
    var x = 258 + (i % 5) * 204, y = 42 + Math.floor(i / 5) * 230;
    var p = palettes[i % palettes.length];
    rect('サンプル ' + i + ' 空', x, y, 200, 200, p[0]);
    polygon('サンプル ' + i + ' 遠景', [[x,y+156],[x+54,y+69],[x+107,y+151],[x+145,y+106],[x+200,y+156],[x+200,y+200],[x,y+200]], p[1]);
    polygon('サンプル ' + i + ' 手前', [[x,y+169],[x+64,y+138],[x+121,y+178],[x+179,y+139],[x+200,y+155],[x+200,y+200],[x,y+200]], p[2]);
    link(x + 4, y + 216, i + 1);
  }
  doc.saveAs(new File(dir + '/store-screenshot.psd'), new PhotoshopSaveOptions(), true, Extension.LOWERCASE);
  doc.flatten();
  doc.saveAs(new File(dir + '/../docs/screenshot.png'), new PNGSaveOptions(), true, Extension.LOWERCASE);
  doc.close(SaveOptions.DONOTSAVECHANGES);
}());
