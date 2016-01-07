{
}


start
  = file


__ "mandatory whitespace"
  = [ \t\n]+ comment?
  / comment

_ "optional whitespace"
  = [ \t\n]* comment?

comment
  = "//" [^\n]* "\n" _

nat
  = digits:$[0-9]+ { return parseInt(digits); }

int
  = "+" num:nat { return num; }
  / "-" num:nat { return -num; }
  / nat

factor
  = num:int _ "/" _ den:nat { return { n: num, d: den }; }
  / int
  / "+" { return  1; }
  / "-" { return -1; }
  / ""  { return  1; }

axis
  = "x" { return 1; }
  / "y" { return 2; }
  / "z" { return 3; }

summand
  = f:factor _ i:axis { return { i: i, f: f }; }
  / f:factor { return { i: 0, f: f }; }

coordinate
  = first:summand _ rest:coordinate { return [first].concat(rest); }
  / only:summand { return [only]; }

operator
  = first:coordinate _ "," _ rest:operator { return [first].concat(rest); }
  / only:coordinate { return [only]; }
