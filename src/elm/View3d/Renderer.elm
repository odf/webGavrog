module View3d.Renderer exposing (Material, Options, Scene, Vertex, entities)

import Math.Matrix4 as Mat4 exposing (Mat4)
import Math.Vector3 as Vec3 exposing (Vec3, vec3)
import Set exposing (Set)
import WebGL
import WebGL.Settings as Settings
import WebGL.Settings.DepthTest as DepthTest


type alias Vertex =
    { pos : Vec3
    , normal : Vec3
    }


type alias Material =
    { ambientColor : Vec3
    , diffuseColor : Vec3
    , specularColor : Vec3
    , ka : Float
    , kd : Float
    , ks : Float
    , shininess : Float
    }


type alias Scene a =
    List
        { a
            | mesh : WebGL.Mesh Vertex
            , wireframe : WebGL.Mesh Vertex
            , material : Material
            , transform : Mat4
            , idxMesh : Int
            , idxInstance : Int
        }


type alias Options =
    { drawWires : Bool
    , fadeToBackground : Float
    , fadeToBlue : Float
    , backgroundColor : Vec3
    , addOutlines : Bool
    , outlineColor : Vec3
    }


type alias Uniforms =
    { sceneCenter : Vec3
    , sceneRadius : Float
    , backgroundColor : Vec3
    , outlineColor : Vec3
    , fadeToBackground : Float
    , fadeToBlue : Float
    , transform : Mat4
    , viewing : Mat4
    , perspective : Mat4
    , cameraPos : Vec3
    , light1Pos : Vec3
    , light1Color : Vec3
    , light2Pos : Vec3
    , light2Color : Vec3
    , light3Pos : Vec3
    , light3Color : Vec3
    , ambientColor : Vec3
    , diffuseColor : Vec3
    , specularColor : Vec3
    , ka : Float
    , kd : Float
    , ks : Float
    , shininess : Float
    }


type alias Varyings =
    { vpos : Vec3
    , vnormal : Vec3
    }


black : Vec3
black =
    vec3 0 0 0


white : Vec3
white =
    vec3 1 1 1


red : Vec3
red =
    vec3 1 0 0


entities :
    Scene a
    -> Vec3
    -> Float
    -> Options
    -> Set ( Int, Int )
    -> Float
    -> Mat4
    -> Mat4
    -> List WebGL.Entity
entities scene center radius options selected camDist viewing perspective =
    let
        baseUniforms =
            { sceneCenter = Mat4.transform viewing center
            , sceneRadius = radius
            , backgroundColor = options.backgroundColor
            , outlineColor = options.outlineColor
            , fadeToBackground = options.fadeToBackground
            , fadeToBlue = options.fadeToBlue
            , transform = Mat4.identity
            , viewing = viewing
            , perspective = perspective
            , cameraPos = vec3 0 0 camDist
            , light1Pos = vec3 2 1 2 |> Vec3.scale (camDist / 2)
            , light1Color = vec3 1 1 1 |> Vec3.scale (2 / 3)
            , light2Pos = vec3 -2 -1 4 |> Vec3.scale (camDist / 4)
            , light2Color = vec3 1 1 1 |> Vec3.scale (1 / 3)
            , light3Pos = vec3 1 1 -4 |> Vec3.scale (camDist / 4)
            , light3Color = vec3 0 0 1 |> Vec3.scale (1 / 5)
            , ambientColor = black
            , diffuseColor = black
            , specularColor = black
            , ka = 0
            , kd = 0
            , ks = 0
            , shininess = 0
            }

        meshUniforms transform material highlight =
            if highlight then
                { baseUniforms
                    | transform = transform
                    , ambientColor = red
                    , diffuseColor = red
                    , specularColor = white
                    , ka = 0.1
                    , kd = 0.9
                    , ks = 0.7
                    , shininess = material.shininess
                }

            else
                { baseUniforms
                    | transform = transform
                    , ambientColor = material.ambientColor
                    , diffuseColor = material.diffuseColor
                    , specularColor = material.specularColor
                    , ka = material.ka
                    , kd = material.kd
                    , ks = material.ks
                    , shininess = material.shininess
                }

        wireUniforms transform material highlight =
            { baseUniforms | transform = transform, fadeToBackground = 0 }
    in
    List.concatMap
        (\{ mesh, wireframe, material, transform, idxMesh, idxInstance } ->
            let
                highlight =
                    Set.member ( idxMesh, idxInstance ) selected
            in
            [ meshUniforms transform material highlight
                |> WebGL.entity vertexShader fragmentShader mesh
                |> Just
            , if options.drawWires then
                wireUniforms transform material highlight
                    |> WebGL.entity vertexShader fragmentShader wireframe
                    |> Just

              else
                Nothing
            , if options.addOutlines then
                meshUniforms transform material highlight
                    |> WebGL.entityWith
                        [ DepthTest.default
                        , Settings.cullFace Settings.front
                        ]
                        vertexShaderOutline
                        fragmentShaderOutline
                        mesh
                    |> Just

              else
                Nothing
            ]
                |> List.filterMap identity
        )
        scene


vertexShader : WebGL.Shader Vertex Uniforms Varyings
vertexShader =
    [glsl|

    attribute vec3 pos;
    attribute vec3 normal;
    uniform mat4 transform;
    uniform mat4 viewing;
    uniform mat4 perspective;
    varying vec3 vpos;
    varying vec3 vnormal;

    void main () {
        vpos = (viewing * transform * vec4(pos, 1.0)).xyz;
        vnormal = (viewing * transform * vec4(normal, 0.0)).xyz;
        gl_Position = perspective * viewing * transform * vec4(pos, 1.0);
    }

    |]


vertexShaderOutline : WebGL.Shader Vertex Uniforms Varyings
vertexShaderOutline =
    [glsl|

    attribute vec3 pos;
    attribute vec3 normal;
    uniform mat4 transform;
    uniform mat4 viewing;
    uniform mat4 perspective;
    varying vec3 vpos;
    varying vec3 vnormal;

    void main () {
        vec3 posx = pos + 0.02 * normal;

        vnormal = (viewing * transform * vec4(normal, 0.0)).xyz;
        vpos = (viewing * transform * vec4(posx, 1.0)).xyz;
        gl_Position = perspective * viewing * transform * vec4(posx, 1.0);
    }

    |]


fragmentShader : WebGL.Shader {} Uniforms Varyings
fragmentShader =
    [glsl|

    precision mediump float;
    uniform vec3 sceneCenter;
    uniform float sceneRadius;
    uniform vec3 backgroundColor;
    uniform float fadeToBackground;
    uniform float fadeToBlue;
    uniform vec3 cameraPos;
    uniform vec3 light1Pos;
    uniform vec3 light1Color;
    uniform vec3 light2Pos;
    uniform vec3 light2Color;
    uniform vec3 light3Pos;
    uniform vec3 light3Color;
    uniform vec3 ambientColor;
    uniform vec3 diffuseColor;
    uniform vec3 specularColor;
    uniform float ka;
    uniform float kd;
    uniform float ks;
    uniform float shininess;
    varying vec3 vpos;
    varying vec3 vnormal;

    vec3 colorFromLight (vec3 lightPos, vec3 lightColor) {
        vec3 normVec = normalize(vnormal);
        vec3 lightVec = normalize(lightPos - vpos);

        float diffuse = dot(normVec, lightVec);
        if (diffuse < 0.0) {
            diffuse *= -0.5;
        }

        float specular = 0.0;

        if (diffuse > 0.0) {
            vec3 reflectVec = reflect(-lightVec, normVec);
            vec3 camVec = normalize(cameraPos - vpos);
            float t = max(dot(reflectVec, camVec), 0.0);
            specular = pow(t, shininess);
        }

        vec3 cd = kd * diffuse * diffuseColor;
        vec3 cs = ks * specular * specularColor;

        return lightColor * (cd + cs);
    }

    void main () {
        vec3 color = ka * ambientColor;
        color += colorFromLight(light1Pos, light1Color);
        color += colorFromLight(light2Pos, light2Color);
        color += colorFromLight(light3Pos, light3Color);

        float depth = (sceneCenter - vpos).z;
        float coeff = smoothstep(-0.9 * sceneRadius, 1.1 * sceneRadius, depth);

        if (fadeToBlue > 0.0) {
            float k = 1.5 / fadeToBlue;
            color = mix(color, vec3(0.0, 0.0, 1.0), pow(coeff, k));
        }

        if (fadeToBackground > 0.0) {
            float k = 0.5 / fadeToBackground;
            color = mix(color, backgroundColor, pow(coeff, k));
        }

        gl_FragColor = vec4(color, 1.0);
    }

    |]


fragmentShaderOutline : WebGL.Shader {} Uniforms Varyings
fragmentShaderOutline =
    [glsl|

    precision mediump float;
    uniform vec3 outlineColor;
    varying vec3 vpos;
    varying vec3 vnormal;

    void main () {
        gl_FragColor = vec4(outlineColor, 1.0);
    }

    |]
