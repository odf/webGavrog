module View3d.RendererWebGLEffects exposing
    ( Mesh
    , convertMeshForRenderer
    , entities
    )

import Array exposing (Array)
import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 exposing (Vec3, vec3)
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
        perspective =
            if options.orthogonalView then
                Camera.orthogonalMatrix
                    model.cameraState
                    model.center
                    (3 * model.radius)

            else
                Camera.perspectiveMatrix
                    model.cameraState
                    model.center
                    (3 * model.radius)

        viewing =
            Camera.viewingMatrix model.cameraState

        uniforms transform fadeColor fadeStrength =
            { sceneCenter = Mat4.transform viewing model.center
            , sceneRadius = model.radius
            , fadeColor = fadeColor
            , fadeStrength = fadeStrength
            , transform = transform
            , viewing = viewing
            , perspective = perspective
            }

        entity transform offset fadeColor fadeStrength mesh =
            uniforms transform fadeColor fadeStrength
                |> WebGL.entityWith
                    [ Blend.add Blend.srcAlpha Blend.oneMinusSrcAlpha
                    , DepthTest.default
                    , WebGL.Settings.polygonOffset offset 0
                    ]
                    vertexShader
                    fragmentShader
                    mesh

        convert { transform } mesh =
            [ entity
                transform
                -1
                (vec3 0 0 1)
                options.fadeToBlue
                mesh
            , entity
                transform
                -2
                options.backgroundColor
                (0.5 * options.fadeToBackground)
                mesh
            ]
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
    varying vec3 vpos;

    void main () {
        float depth = (sceneCenter - vpos).z;
        float coeff = smoothstep(-0.9 * sceneRadius, 1.1 * sceneRadius, depth);
        float alpha;

        if (fadeStrength > 0.0)
            alpha = pow(coeff, 1.0 / fadeStrength);
        else
            alpha = 0.0;

        gl_FragColor = vec4(fadeColor, alpha);
    }

    |]
