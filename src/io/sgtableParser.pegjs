{
  function _negate(x) {
    if (typeof x == 'number')
      return -x;
    else
      return { n: -x.n, d: x.d };
  }

  function negate(s) {
    return { i: s.i, f: _negate(s.f) }
  }
}


start
  = file


_ "optional whitespace"
  = [ \t]*

__ "mandatory whitespace"
  = [ \t]+

comment
  = "#" $[^\n]*

nl "new line"
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
  / f:factor (_ "*"?) i:axis { return { i: i, f: f }; }
  / f:factor { return { i: 0, f: f }; }

furtherSummand
  = _ "+" s:summand { return s; }
  / _ "-" s:summand { return negate(s); }

coordinate
  = first:summand rest:furtherSummand*
    { return [first].concat(rest); }
  / "-" first:summand rest:furtherSummand*
    { return [negate(first)].concat(rest); }

operator
  = first:coordinate _ "," _ rest:operator { return [first].concat(rest); }
  / only:coordinate { return [only]; }

operators
  = __ first:operator nl rest:operators { return [first].concat(rest); }
  / __ only:operator { return [only]; }

entry
  = "alias" __ name:name __ fullName:name
    {
      return { type: 'alias', name: name, fullName: fullName };
    }
  / "lookup" __ n:name __ s:$[a-z]+ __ c:$[A-Za-z] __ op:operator
    {
      return { type: 'lookup', name: n, system: s, centering: c, fromStd: op };
    }
  / n:name __ t:operator nl ops:operators
    {
      return { type: 'setting', name: n, transform: t, operators: ops };
    }

entries
  = first:entry nl rest:entries { return [first].concat(rest); }
  / only:entry { return [only]; }

file
  = nl? entries:entries nl? { return entries; }
