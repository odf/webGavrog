module Camera
    exposing
        ( State
        , initialState
        , nextFrame
        , setMousePosition
        , updateZoom
        , setFrameSize
        , startDragging
        , finishDragging
        , lookAlong
        , perspectiveMatrix
        , viewingMatrix
        , cameraDistance
        , isMoving
        )

import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 as Vec3 exposing (vec3, Vec3)
import Mouse
import Window


type alias Position =
    { x : Float
    , y : Float
    }


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
        , deltaRot : Mat4
        , moved : Bool
        }


initialState : State
initialState =
    State
        { size = { width = 0, height = 0 }
        , origin = { x = 0, y = 0 }
        , cameraDistance = 5
        , fieldOfView = 45
        , dragging = False
        , moving = False
        , ndcPos = { x = 0, y = 0 }
        , rotation = Mat4.identity
        , deltaRot = Mat4.identity
        , moved = False
        , shift = vec3 0 0 0
        }


nextFrame : Float -> State -> State
nextFrame float (State state) =
    if state.dragging then
        State { state | moved = False }
    else if state.moving then
        let
            rotation =
                orthonormalized <| Mat4.mul state.deltaRot state.rotation
        in
            State { state | rotation = rotation }
    else
        State state


setMousePosition : Mouse.Position -> Bool -> State -> State
setMousePosition pos alter (State state) =
    let
        xRelative =
            ((toFloat pos.x) - state.origin.x) / state.size.width

        yRelative =
            ((toFloat pos.y) - state.origin.y) / state.size.height

        ndcPos =
            { x = 2 * xRelative - 1, y = 1 - 2 * yRelative }
    in
        if state.dragging then
            if alter then
                panMouse ndcPos (State state)
            else
                rotateMouse ndcPos (State state)
        else
            State { state | ndcPos = ndcPos }


updateZoom : Float -> Bool -> State -> State
updateZoom value alter (State state) =
    let
        factor =
            if value > 0 then
                0.9
            else if value < 0 then
                1 / 0.9
            else
                1.0

        newState =
            if alter then
                { state | fieldOfView = factor * state.fieldOfView }
            else
                { state | cameraDistance = factor * state.cameraDistance }
    in
        State newState


setFrameSize : Window.Size -> State -> State
setFrameSize size (State state) =
    State
        { state
            | size =
                { width = toFloat size.width
                , height = toFloat size.height
                }
        }


startDragging : State -> State
startDragging (State state) =
    State { state | dragging = True, moving = True, moved = False }


finishDragging : Mouse.Position -> State -> State
finishDragging pos (State state) =
    State { state | dragging = False, moving = state.moved }


lookAlong : Vec3 -> Vec3 -> State -> State
lookAlong axis up (State state) =
    State { state | rotation = Mat4.makeLookAt (vec3 0 0 0) axis up }


panMouse : Position -> State -> State
panMouse ndcPosNew (State state) =
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
                , moved = False
                , shift = Vec3.add state.shift shift
            }


rotateMouse : Position -> State -> State
rotateMouse ndcPosNew (State state) =
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
                , deltaRot = deltaRot
                , rotation = rotation
                , moved = angle /= 0
            }


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
        Mat4.makePerspective fovy aspectRatio 0.01 100


cameraDistance : State -> Float
cameraDistance (State state) =
    state.cameraDistance


isMoving : State -> Bool
isMoving (State state) =
    state.moving
