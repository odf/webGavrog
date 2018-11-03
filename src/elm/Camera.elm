module Camera exposing
    ( State
    , cameraDistance
    , dragTo
    , encompass
    , finishDragging
    , initialState
    , isDragging
    , isMoving
    , lookAlong
    , nextFrame
    , perspectiveMatrix
    , setFrameSize
    , setRedraws
    , startDragging
    , updateZoom
    , viewingMatrix
    )

import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 as Vec3 exposing (Vec3, vec3)
import Time exposing (Posix)


type alias Position =
    { x : Float, y : Float }


type State
    = State
        { size : { width : Float, height : Float }
        , origin : Position
        , cameraDistance : Float
        , fieldOfView : Float
        , dragging : Bool
        , moving : Bool
        , ndcPos : Position
        , shift : Vec3
        , rotation : Mat4
        , spinAxis : Vec3
        , spinAngle : Float
        , milliSecsSinceMoved : Float
        }


initialState : State
initialState =
    State
        { size = { width = 0, height = 0 }
        , origin = { x = 0, y = 0 }
        , cameraDistance = 12
        , fieldOfView = 25
        , dragging = False
        , moving = False
        , ndcPos = { x = 0, y = 0 }
        , rotation = Mat4.identity
        , spinAxis = vec3 0 0 1
        , spinAngle = 0
        , milliSecsSinceMoved = 0
        , shift = vec3 0 0 0
        }


nextFrame : Float -> State -> State
nextFrame timeInMilliSecs (State state) =
    if state.dragging then
        State
            { state
                | milliSecsSinceMoved =
                    state.milliSecsSinceMoved + timeInMilliSecs
            }

    else if state.moving then
        let
            angle =
                state.spinAngle * timeInMilliSecs

            deltaRot =
                Mat4.makeRotate angle state.spinAxis

            rotation =
                orthonormalized <| Mat4.mul deltaRot state.rotation
        in
        State { state | rotation = rotation }

    else
        State state


positionToNdc : Position -> State -> Position
positionToNdc pos (State state) =
    let
        xRelative =
            (pos.x - state.origin.x) / state.size.width

        yRelative =
            (pos.y - state.origin.y) / state.size.height
    in
    { x = 2 * xRelative - 1, y = 1 - 2 * yRelative }


updateZoom : Float -> Bool -> State -> State
updateZoom factor alter (State state) =
    if alter then
        State
            { state
                | fieldOfView =
                    clamp 2.5 150 <| factor * state.fieldOfView
            }

    else
        State
            { state
                | cameraDistance =
                    clamp 2.5 1000 <| factor * state.cameraDistance
            }


setFrameSize : { width : Int, height : Int } -> State -> State
setFrameSize size (State state) =
    State
        { state
            | size =
                { width = toFloat size.width
                , height = toFloat size.height
                }
        }


startDragging : Position -> State -> State
startDragging pos (State state) =
    State
        { state
            | dragging = True
            , moving = True
            , ndcPos = positionToNdc pos (State state)
            , spinAngle = 0
        }


dragTo : Position -> Bool -> State -> State
dragTo pos alter (State state) =
    let
        ndcPos =
            positionToNdc pos (State state)
    in
    if state.dragging then
        if alter then
            panTo ndcPos (State state)

        else
            rotateTo ndcPos (State state)

    else
        State { state | ndcPos = ndcPos }


finishDragging : State -> State
finishDragging (State state) =
    State
        { state
            | dragging = False
            , moving = state.milliSecsSinceMoved < 100
        }


panTo : Position -> State -> State
panTo ndcPosNew (State state) =
    let
        dx =
            ndcPosNew.x - state.ndcPos.x

        dy =
            ndcPosNew.y - state.ndcPos.y

        invRot =
            Mat4.inverseOrthonormal state.rotation

        shift =
            Mat4.transform invRot <| vec3 dx dy 0
    in
    State
        { state
            | ndcPos = ndcPosNew
            , shift = Vec3.add state.shift shift
        }


rotateTo : Position -> State -> State
rotateTo ndcPosNew (State state) =
    let
        ( axis, angle ) =
            rotationParameters ndcPosNew state.ndcPos

        deltaRot =
            Mat4.makeRotate angle axis

        rotation =
            orthonormalized <| Mat4.mul deltaRot state.rotation
    in
    State
        { state
            | ndcPos = ndcPosNew
            , spinAxis = axis
            , spinAngle = 60 * angle / 1000
            , rotation = rotation
            , milliSecsSinceMoved = 0
        }


lookAlong : Vec3 -> Vec3 -> State -> State
lookAlong axis up (State state) =
    State { state | rotation = Mat4.makeLookAt (vec3 0 0 0) axis up }


encompass : Vec3 -> Float -> State -> State
encompass center radius (State state) =
    let
        dist =
            radius / sin (degrees state.fieldOfView / 2)
    in
    State
        { state
            | shift = Vec3.scale -1 center
            , cameraDistance = clamp 2.5 1000 dist
        }


rotationParameters : Position -> Position -> ( Vec3, Float )
rotationParameters newPos oldPos =
    let
        dx =
            (newPos.x - oldPos.x) * pi / 2

        dy =
            (newPos.y - oldPos.y) * pi / 2

        aroundZ =
            abs newPos.x > 0.9 || abs newPos.y > 0.9

        angle =
            if aroundZ then
                zRotationAngle newPos.x newPos.y dx dy

            else
                dx ^ 2 + dy ^ 2 |> sqrt

        axis =
            if angle == 0 || aroundZ then
                vec3 0 0 1

            else
                vec3 (-dy / angle) (dx / angle) 0
    in
    ( axis, angle )


zRotationAngle : Float -> Float -> Float -> Float -> Float
zRotationAngle px py dx dy =
    if px > 0.9 then
        dy

    else if px < -0.9 then
        -dy

    else if py > 0.9 then
        -dx

    else if py < -0.9 then
        dx

    else
        0


projection : Vec3 -> Vec3 -> Vec3
projection v n =
    Vec3.scale (Vec3.dot v n) v


orthonormalized : Mat4 -> Mat4
orthonormalized m =
    let
        b1 =
            Mat4.transform m <| vec3 1 0 0

        b2 =
            Mat4.transform m <| vec3 0 1 0

        b3 =
            Mat4.transform m <| vec3 0 0 1

        n1 =
            Vec3.normalize b1

        n2 =
            Vec3.normalize
                (Vec3.sub b2 (projection b2 n1))

        n3 =
            Vec3.normalize
                (Vec3.sub b3 (Vec3.add (projection b3 n1) (projection b3 n2)))
    in
    Mat4.makeBasis n1 n2 n3


viewingMatrix : State -> Mat4
viewingMatrix (State state) =
    let
        camVector =
            vec3 0 0 state.cameraDistance

        camMatrix =
            Mat4.makeLookAt camVector (vec3 0 0 0) (vec3 0 1 0)

        shift =
            Mat4.makeTranslate state.shift
    in
    Mat4.mul camMatrix <| Mat4.mul state.rotation shift


perspectiveMatrix : State -> Mat4
perspectiveMatrix (State state) =
    let
        aspectRatio =
            state.size.width / state.size.height

        fov =
            state.fieldOfView

        fovy =
            if aspectRatio >= 1 then
                fov

            else
                atan (tan (degrees (fov / 2)) / aspectRatio) * 360 / pi
    in
    Mat4.makePerspective fovy aspectRatio 1 10000


cameraDistance : State -> Float
cameraDistance (State state) =
    state.cameraDistance


isDragging : State -> Bool
isDragging (State state) =
    state.dragging


isMoving : State -> Bool
isMoving (State state) =
    state.moving


setRedraws : Bool -> State -> State
setRedraws onOff (State state) =
    State { state | moving = onOff }
