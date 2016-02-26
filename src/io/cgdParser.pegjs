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
  = $([A-Za-z][^\t\n "]*)

numberCore
  = [0-9]+ ("." [0-9]*)?
  / "." [0-9]+

number
  = sign:$"-"? core:$numberCore exp:$("e" [+-]? [0-9]+)? [bf]?
    { return parseFloat(sign + core + exp); }

factor
  = num:number _ "/" _ den:number { return { n: num, d: den }; }
  / number

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

field
  = __ op:operator { return op; }
  / __ fp:number   { return fp; }
  / __ st:string   { return st; }
  / __ nm:name     { return nm; }

contentLine
  = key:keyword args:field* _ nl { return { key: key, args: args }; }
  / args:field* _ nl { return { args: args }; }

block
  = type:keyword nl content:contentLine* end nl
    { return { type: type, content: content }; }

file
  = nl? blocks:block* { return blocks; }
