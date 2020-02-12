#!/usr/bin/env python

import re
import sys


def containsFloat(s):
    try:
        float(s)
        return True
    except:
        return False


def closeEnough(s1, s2):
    if s1 == s2:
        return True
    elif containsFloat(s1) and containsFloat(s2):
        f1 = float(s1)
        f2 = float(s2)

        if f1 == 0:
            return f2 == 0
        elif f2 == 0:
            return f1 == 0
        else:
            return abs(f1 - f2) < 0.1 * min(abs(f1), abs(f2))


if __name__ == "__main__":
    with open(sys.argv[1]) as fp:
        lines1 = fp.readlines()

    with open(sys.argv[2]) as fp:
        lines2 = fp.readlines()

    if len(lines1) != len(lines2):
        raise RuntimeError("Different number of lines in files.")

    pattern = '([\s,]+)'
    lastBad = None

    for i in range(len(lines1)):
        if lines1[i] != lines2[i]:
            fields1 = re.split(pattern, lines1[i])
            fields2 = re.split(pattern, lines2[i])

            if len(fields1) != len(fields2):
                raise RuntimeError("Different number of fields in line %d." % i)

            close = True
            log = []

            for j in range(len(fields1)):
                if closeEnough(fields1[j], fields2[j]):
                    log.append(fields1[j])
                else:
                    close = False
                    log.append("[-%s-]{+%s+}" % (fields1[j], fields2[j]))

            if not close:
                if lastBad is not None and i > lastBad + 1:
                    print

                print "%d: %s" % (i, ''.join(log)),
                lastBad = i
