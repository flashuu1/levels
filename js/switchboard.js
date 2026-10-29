(function (root) {
  'use strict';
  // The old telephone exchange: what takes the dead terminal's place for the later stories. For now it is a quiet room: a board of brass
  // jacks, most of them dark, and a single lamp that lights once the terminal has died. Something is still to be plugged in.
  function create(env) {
    var el = env.el;
    function view() {
      env.visit('switchboard'); env.head('The exchange', '#/', 'Start');
      var room = el('div', 'exchange'), lit = env.deadTerminal();
      var board = el('div', 'ex-board'); board.setAttribute('role', 'img'); board.setAttribute('aria-label', 'A telephone switchboard: rows of brass jacks, nearly all of them dark.');
      for (var r = 0; r < 3; r++) for (var c = 0; c < 8; c++) { var j = el('span', 'ex-jack' + (lit && r === 0 && c === 0 ? ' lit' : '')); board.appendChild(j); }
      room.appendChild(board);
      room.appendChild(el('p', 'mute', lit
        ? 'The old exchange behind the post office. Twenty-four brass jacks and one small lamp, lit. A cord hangs from the hook beside it, waiting for a pair of hands.'
        : 'The old telephone exchange behind the post office. The board is dark and the cords hang from their hook. Nobody has sat at it for years.'));
      room.appendChild(el('p', 'mute', 'The operator\'s chair is still warm.'));
      env.view.appendChild(room);
    }
    return { view: view };
  }
  var api = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Switchboard = api;
})(typeof window !== 'undefined' ? window : globalThis);
