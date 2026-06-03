// ============================================================
//  PLAYER CONFIG — edit this file and push to update.
//  To find an ID: node find-player.js "First Last"
//  MLB and MiLB use the same ID system.
// ============================================================

module.exports = {

  // Set true to also watch MiLB games (AAA → Rookie)
  includeMiLB: true,

  players: [
    // ---- MLB ------------------------------------------------
    { name: "Harrison Bader",     mlbId: 664056 },
    { name: "Alex Bregman",       mlbId: 608324 },
    { name: "Zack Gelof",         mlbId: 680869 },
    { name: "Spencer Horwitz",    mlbId: 687462 },
    { name: "Joc Pederson",       mlbId: 592626 },
    { name: "Garrett Stubbs",     mlbId: 596117 },

    { name: "Dalton Guthrie",     mlbId: 656495 },
    { name: "Jared Lakind",       mlbId: 592481 },   // P/1B
    { name: "Michael Wielansky",  mlbId: 681933 },

    { name: "RJ Schreck",         mlbId: 702302 },
    { name: "CJ Stubbs",          mlbId: 667690 },
    { name: "Rowdy Tellez",       mlbId: 642133 },
    { name: "Andy Yerzy",         mlbId: 647378 },

    // ---- MiLB prospects -------------------------------------
    { name: "Jordan Dissin",      mlbId: 805301 },
    { name: "Jake Gelof",         mlbId: 695372 },
    { name: "Zach Levenson",      mlbId: 804241 },
    { name: "Noah Mendlinger",    mlbId: 702331 },
    { name: "Michael Snyder",     mlbId: 688617 },

    { name: "Henry Godbout",      mlbId: 804995 },

    { name: "Sam Biller",         mlbId: 813697 },
    { name: "Levi Sterling",      mlbId: 815552 },   // P/3B
  ],

};
