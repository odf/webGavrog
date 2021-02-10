module View3d.Camera exposing
    ( Ray
    , State
    , cameraDistance
    , dragTo
    , encompass
    , eyePoint
    , finishDragging
    , focalPoint
    , initialState
    , lookAlong
    , needsFrameEvents
    , needsMouseEvents
    , nextFrame
    , orthogonalMatrix
    , perspectiveMatrix
    , pickingRay
    , pinchTo
    , rotateBy
    , setFrameSize
    , startDragging
    , startPinching
    , upDirection
    , updateZoom
    , verticalFieldOfView
    , viewPortHeight
    , viewingMatrix
    , wasDragged
    )

import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 as Vec3 exposing (Vec3, vec3)


type alias FrameSize =
    { width : Float, height : Float }


type alias Position =
    { x : Float, y : Float }


type State
    = State
        { size : FrameSize
        , cameraDistance : Float
        , fieldOfView : Float
        , dragging : Bool
        , moving : Bool
        , ndcPos : Position
        , ndcPosDragStart : Position
        , wasDragged : Bool
        , pinchDist : Float
        , shift : Vec3
        , rotation : Mat4
        , spinAxis : Vec3
        , spinAngle : Float
        , milliSecsSinceMoved : Float
        }


type alias Ray =
    { origin : Vec3, direction : Vec3 }


initialState : State
initialState =
    State
        { size = { width = 0, height = 0 }
        , cameraDistance = 12
        , fieldOfView = 25
        , dragging = False
        , moving = False
        , ndcPos = { x = 0, y = 0 }
        , ndcPosDragStart = { x = 0, y = 0 }
        , wasDragged = False
        , pinchDist = 0
        , rotation = Mat4.identity
        , spinAxis = vec3 0 0 1
        , spinAngle = 0
        , milliSecsSinceMoved = 0
        , shift = vec3 0 0 0
        }


setFrameSize : FrameSize -> State -> State
setFrameSize size (State state) =
    State { state | size = size }


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
positionToNdc { x, y } (State { size }) =
    { x = 2 * x / size.width - 1
    , y = 1 - 2 * y / size.height
    }


pickingRay : Position -> State -> Vec3 -> Float -> Maybe Ray
pickingRay pos state sceneCenter sceneRadius =
    let
        makeRay mat =
            let
                posNdc =
                    positionToNdc pos state

                eye =
                    Mat4.transform mat (vec3 posNdc.x posNdc.y -1)

                center =
                    Mat4.transform mat (vec3 posNdc.x posNdc.y 0)
            in
            { origin = eye
            , direction = Vec3.sub center eye |> Vec3.normalize
            }
    in
    Mat4.mul
        (perspectiveMatrix state sceneCenter sceneRadius)
        (viewingMatrix state)
        |> Mat4.inverse
        |> Maybe.map makeRay


updateZoom : Float -> Bool -> State -> State
updateZoom factor alter (State state) =
    if alter then
        let
            fov =
                clamp 2 90 <| state.fieldOfView * factor

            clampedFactor =
                fov / state.fieldOfView
        in
        State
            { state
                | fieldOfView = fov
                , cameraDistance = state.cameraDistance / clampedFactor
            }

    else
        State
            { state
                | cameraDistance =
                    clamp 2.5 1000 <| state.cameraDistance * factor
            }


distance : Position -> Position -> Float
distance posA posB =
    sqrt ((posA.x - posB.x) ^ 2 + (posA.y - posB.y) ^ 2)


startPinching : Position -> Position -> State -> State
startPinching posA posB (State state) =
    State { state | pinchDist = distance posA posB }


pinchTo : Position -> Position -> Bool -> State -> State
pinchTo posA posB alter (State state) =
    let
        d =
            distance posA posB

        f =
            clamp 0.9 1.11 (state.pinchDist / d)

        (State s) =
            updateZoom f alter (State state)
    in
    State { s | pinchDist = d }


startDragging : Position -> State -> State
startDragging pos (State state) =
    let
        ndcPos =
            positionToNdc pos (State state)
    in
    State
        { state
            | dragging = True
            , moving = True
            , wasDragged = False
            , ndcPos = ndcPos
            , ndcPosDragStart = ndcPos
            , spinAngle = 0
        }


dragTo : Position -> Bool -> State -> State
dragTo pos alter (State state) =
    let
        ndcPos =
            positionToNdc pos (State state)

        dragged =
            state.wasDragged || (ndcPos /= state.ndcPosDragStart)
    in
    if state.dragging then
        if alter then
            panTo ndcPos (State { state | wasDragged = dragged })

        else
            rotateTo ndcPos (State { state | wasDragged = dragged })

    else
        State
            { state
                | ndcPos = ndcPos
                , wasDragged = dragged
            }


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


rotateBy : Vec3 -> Float -> State -> State
rotateBy axis angle (State state) =
    let
        deltaRot =
            Mat4.makeRotate angle axis

        rotation =
            orthonormalized <| Mat4.mul deltaRot state.rotation
    in
    State { state | rotation = rotation }


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


inverseViewingMatrix : State -> Mat4
inverseViewingMatrix =
    viewingMatrix >> Mat4.inverse >> Maybe.withDefault Mat4.identity


clippingPlanes : State -> Vec3 -> Float -> { near : Float, far : Float }
clippingPlanes (State state) center radius =
    let
        d =
            center
                |> Mat4.transform (viewingMatrix (State state))
                |> Vec3.negate
                |> Vec3.getZ

        near =
            max 0.5 (d - radius) * 0.99

        far =
            (d + radius + 2 * sqrt 3 * radius) * 1.01
    in
    { near = near, far = far }


perspectiveMatrix : State -> Vec3 -> Float -> Mat4
perspectiveMatrix (State state) center radius =
    let
        { near, far } =
            clippingPlanes (State state) center radius

        aspectRatio =
            state.size.width / state.size.height

        fovy =
            verticalFieldOfView (State state)
    in
    Mat4.makePerspective fovy aspectRatio near far


viewPortHeight : State -> Float
viewPortHeight (State state) =
    let
        aspectRatio =
            state.size.width / state.size.height

        fovy =
            verticalFieldOfView (State state)

        delta =
            tan (degrees (fovy / 2)) * state.cameraDistance
    in
    2 * delta * min aspectRatio 1


orthogonalMatrix : State -> Vec3 -> Float -> Mat4
orthogonalMatrix (State state) center radius =
    let
        { near, far } =
            clippingPlanes (State state) center radius

        dy =
            viewPortHeight (State state) / 2

        dx =
            dy / state.size.height * state.size.width
    in
    Mat4.makeOrtho -dx dx -dy dy near far


cameraDistance : State -> Float
cameraDistance (State state) =
    state.cameraDistance


verticalFieldOfView : State -> Float
verticalFieldOfView (State state) =
    let
        aspectRatio =
            state.size.width / state.size.height

        fov =
            state.fieldOfView
    in
    if aspectRatio >= 1 then
        fov

    else
        atan (tan (degrees (fov / 2)) / aspectRatio) * 360 / pi


focalPoint : State -> Vec3
focalPoint (State state) =
    Mat4.transform
        (inverseViewingMatrix (State state))
        (vec3 0 0 -state.cameraDistance)


eyePoint : State -> Vec3
eyePoint (State state) =
    Mat4.transform
        (inverseViewingMatrix (State state))
        (vec3 0 0 0)


upDirection : State -> Vec3
upDirection (State state) =
    let
        inv =
            inverseViewingMatrix (State state)
    in
    Vec3.sub
        (Mat4.transform inv (vec3 0 1 0))
        (Mat4.transform inv (vec3 0 0 0))


needsMouseEvents : State -> Bool
needsMouseEvents (State state) =
    state.dragging


needsFrameEvents : State -> Bool
needsFrameEvents (State state) =
    state.moving


wasDragged : State -> Bool
wasDragged (State state) =
    state.wasDragged
