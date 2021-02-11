module View3d.RendererWebGLEffects exposing
    ( Mesh
    , convertMeshForRenderer
    , entities
    )

import Array exposing (Array)
import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 exposing (Vec3)
import Maybe
import View3d.Camera as Camera
import View3d.Mesh as Mesh
import View3d.RendererCommon exposing (..)
import WebGL
import WebGL.Settings
import WebGL.Settings.Blend as Blend
import WebGL.Settings.DepthTest as DepthTest


type alias Mesh =
    WebGL.Mesh Vertex


type alias Uniforms =
    { sceneCenter : Vec3
    , sceneRadius : Float
    , fadeColor : Vec3
    , fadeStrength : Float
    , blueShift : Float
    , transform : Mat4
    , viewing : Mat4
    , perspective : Mat4
    }


type alias Varyings =
    { vpos : Vec3 }


convertMeshForRenderer : Mesh.Mesh Vertex -> Mesh
convertMeshForRenderer mesh =
    case mesh of
        Mesh.Lines lines ->
            WebGL.lines lines

        Mesh.Triangles triangles ->
            WebGL.triangles triangles

        Mesh.IndexedTriangles vertices triangles ->
            WebGL.indexedTriangles vertices triangles


entities : Array Mesh -> Model a -> Options -> List WebGL.Entity
entities meshes model options =
    let
        radius =
            3 * model.radius

        perspective =
            if options.orthogonalView then
                Camera.orthogonalMatrix model.cameraState model.center radius

            else
                Camera.perspectiveMatrix model.cameraState model.center radius

        viewing =
            Camera.viewingMatrix model.cameraState

        uniforms =
            { sceneCenter = Mat4.transform viewing model.center
            , sceneRadius = model.radius
            , fadeColor = options.backgroundColor
            , fadeStrength = 0.5 * options.fadeToBackground
            , blueShift = options.fadeToBlue
            , transform = Mat4.identity
            , viewing = viewing
            , perspective = perspective
            }

        convert { transform } mesh =
            if options.fadeToBackground > 0 || options.fadeToBlue > 0 then
                [ WebGL.entityWith
                    [ Blend.add Blend.srcAlpha Blend.oneMinusSrcAlpha
                    , DepthTest.default
                    , WebGL.Settings.polygonOffset -0.1 0
                    ]
                    vertexShader
                    fragmentShader
                    mesh
                    { uniforms | transform = transform }
                ]

            else
                []
    in
    model.scene
        |> List.concatMap
            (\item ->
                Array.get item.idxMesh meshes
                    |> Maybe.map (convert item)
                    |> Maybe.withDefault []
            )


vertexShader : WebGL.Shader Vertex Uniforms Varyings
vertexShader =
    [glsl|

    attribute vec3 position;
    uniform mat4 transform;
    uniform mat4 viewing;
    uniform mat4 perspective;
    varying vec3 vpos;

    void main () {
        vpos = (viewing * transform * vec4(position, 1.0)).xyz;
        gl_Position = perspective * vec4(vpos, 1.0);
    }

    |]


fragmentShader : WebGL.Shader {} Uniforms Varyings
fragmentShader =
    [glsl|

    precision mediump float;
    uniform vec3 sceneCenter;
    uniform float sceneRadius;
    uniform vec3 fadeColor;
    uniform float fadeStrength;
    uniform float blueShift;
    varying vec3 vpos;

    void main () {
        float depth = (sceneCenter - vpos).z;
        float coeff = smoothstep(-0.9 * sceneRadius, 1.1 * sceneRadius, depth);
        float s = fadeStrength > 0.0 ? pow(coeff, 1.0 / fadeStrength) : 0.0;
        float t = blueShift > 0.0 ? pow(coeff, 1.0 / blueShift) : 0.0;

        float alpha = s + t - s * t;
        float beta = alpha > 0.0 ? s / alpha : 0.0;
        vec3 blue = vec3(0.0, 0.0, 1.0);
        vec3 color = beta * fadeColor + (1.0 - beta) * blue;

        gl_FragColor = vec4(color, alpha);
    }

    |]
