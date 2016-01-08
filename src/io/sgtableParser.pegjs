{
  function negate(x) {
    if (typeof x == 'number')
      return -x;
    else
      return { n: -x.n, d: x.d };
  }

  function negateFirst(a) {
    if (a.length == 0)
      return a;
    var result = a.slice();
    result[0] = { i: a[0].i, f: negate(a[0].f) };
    return result;
  }
}

start
  = file

_ "optional whitespace"
  = [ \t]*

__ "mandatory whitespace"
  = [ \t]+

comment
  = "//" $[^\n]*

nl "advances to the next non-empty line"
  = (_ comment? "\n")+

name
  = $[A-Za-z0-9/:-]+

nat
  = digits:$[0-9]+ { return parseInt(digits); }


factor
  = num:nat _ "/" _ den:nat { return { n: num, d: den }; }
  / nat

axis
  = "x" { return 1; }
  / "y" { return 2; }
  / "z" { return 3; }

summand
  = i:axis { return { i: i, f: 1 }; }
  / f:factor _ i:axis { return { i: i, f: f }; }
  / f:factor { return { i: 0, f: f }; }

coordinate
  = first:summand _ "-" _ rest:coordinate
    { return [first].concat(negateFirst(rest)); }
  / first:summand _ "+" _ rest:coordinate
    { return [first].concat(rest); }
  / "-" _ only:summand { return negateFirst([only]); }
  / only:summand { return [only]; }

operator
  = first:coordinate _ "," _ rest:operator { return [first].concat(rest); }
  / only:coordinate { return [only]; }

entry
  = "alias" __ name:name __ fullName:name
    { return { type: 'alias', name: name, fullName: fullName } }
  / "lookup" __ name:name __ system:$[a-z]+ __ centering:$[A-Z] __ fromStd:operator
    { return {
        type     : 'lookup',
        name     : name,
        system   : system,
        centering: centering,
        fromStd  : fromStd
        };
     }

entries
  = first:entry nl _ rest:entries { return [first].concat(rest); }
  / only:entry { return [only]; }

file
  = nl? entries:entries nl? { return entries; }
