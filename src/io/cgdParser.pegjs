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

  function fixCoordinate(coord) {
    var t = coord;
    return (t.length == 1 && t[0].i == 0) ? t[0].f : t;
  }

  function fixOperator(op) {
    var t = op.map(fixCoordinate);
    return t.length == 1 ? t[0] : t;
  }

  function fixBlockContent(content) {
    var t = [];
    var k = null;

    for (var i in content) {
      var line = content[i];
      if (line.key != null)
        k = line.key;
      if (line.args.length > 0)
        t.push({ key: k, args: line.args });
    }

    return t;
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

end
  = [eE][nN][dD]

keyword
  = !end key:$([A-Za-z][A-Za-z0-9_]*) { return key.toLowerCase(); }

stringChunk
  = chars:$[^"\\]+ { return chars; }
  / "\\\"" { return "\""; }
  / "\\\'" { return "\'"; }
  / "\\\\" { return "\\"; }
  / "\\n"  { return "\n"; }
  / "\\t"  { return "\t"; }

string
  = "\"" chunks:stringChunk* "\"" { return chunks.join(''); }

name
  = !end val:$([A-Za-z][^\t\n "]*) { return val; }

nat
  = digits:$[0-9]+ { return parseInt(digits); }

floatCore
  = [0-9]+ "." [0-9]*
  / "." [0-9]+

float
  = sign:$"-"? core:$floatCore exp:$("e" [+-]? [0-9]+)? [bf]?
    { return parseFloat(sign + core + exp); }

number
  = num:nat "/" den:nat { return { n: num, d: den }; }
  / float
  / nat

axis
  = "x" { return 1; }
  / "y" { return 2; }
  / "z" { return 3; }

summand
  = i:axis { return { i: i, f: 1 }; }
  / f:number "*"? i:axis { return { i: i, f: f }; }
  / f:number { return { i: 0, f: f }; }

furtherSummand
  = "+" s:summand { return s; }
  / "-" s:summand { return negate(s); }

coordinate
  = first:summand rest:furtherSummand*
    { return [first].concat(rest); }
  / "-" first:summand rest:furtherSummand*
    { return [negate(first)].concat(rest); }

furtherCoordinate
  = _ "," _ c:coordinate { return c; }

operator
  = first:coordinate rest:furtherCoordinate* { return [first].concat(rest); }

field
  = op:operator { return fixOperator(op); }
  / number
  / "-" val:nat { return -val; }
  / string
  / name

additionalField
  = __ f:field { return f; }

contentLine
  = _ key:keyword args:additionalField* _ nl
    { return { key: key, args: args }; }
  / _ first:field rest:additionalField* _ nl
    { return { args: [first].concat(rest) }; }

block
  = type:keyword nl content:contentLine* end
    { return { type: type, content: fixBlockContent(content) }; }

furtherBlock
  = nl b:block { return b; }

file
  = first:block rest:furtherBlock* nl? _ { return [first].concat(rest); }
  / blocks:furtherBlock* nl? _ { return blocks; }
