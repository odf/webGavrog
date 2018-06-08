module Renderer exposing (Vertex, Material, entity)

import Math.Matrix4 exposing (Mat4)
import Math.Vector3 as Vec3 exposing (vec3, Vec3)
import WebGL


type alias Vertex =
    { color : Vec3
    , pos : Vec3
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


type alias Uniforms =
    { viewing : Mat4
    , perspective : Mat4
    , cameraPos : Vec3
    , light1Pos : Vec3
    , light1Color : Vec3
    , light2Pos : Vec3
    , light2Color : Vec3
    , ambientColor : Vec3
    , diffuseColor : Vec3
    , specularColor : Vec3
    , ka : Float
    , kd : Float
    , ks : Float
    , shininess : Float
    }


type alias Varyings =
    { vcolor : Vec3
    , vpos : Vec3
    , vnormal : Vec3
    }


scaleTo : Float -> Vec3 -> Vec3
scaleTo length vec =
    vec |> Vec3.normalize |> Vec3.scale length


entity : WebGL.Mesh Vertex -> Material -> Float -> Mat4 -> Mat4 -> WebGL.Entity
entity mesh material camDist viewingMatrix perspectiveMatrix =
    let
        uniforms =
            { viewing = viewingMatrix
            , perspective = perspectiveMatrix
            , cameraPos = vec3 0 0 camDist
            , light1Pos = vec3 -1 1 2 |> scaleTo (50 * camDist)
            , light1Color = vec3 1 1 1
            , light2Pos = vec3 2 -2 1 |> scaleTo (50 * camDist)
            , light2Color = vec3 1 1 1 |> scaleTo 0.5
            , ambientColor = material.ambientColor
            , diffuseColor = material.diffuseColor
            , specularColor = material.specularColor
            , ka = material.ka
            , kd = material.kd
            , ks = material.ks
            , shininess = material.shininess
            }
    in
        WebGL.entity vertexShader fragmentShader mesh uniforms


vertexShader : WebGL.Shader Vertex Uniforms Varyings
vertexShader =
    [glsl|

    attribute vec3 color;
    attribute vec3 pos;
    attribute vec3 normal;
    uniform mat4 viewing;
    uniform mat4 perspective;
    varying vec3 vcolor;
    varying vec3 vpos;
    varying vec3 vnormal;

    void main () {
        vcolor = color;
        vpos = (viewing * vec4(pos, 1.0)).xyz;
        vnormal = (viewing * vec4(normal, 0.0)).xyz;
        gl_Position = perspective * viewing * vec4(pos, 1.0);
    }

    |]


fragmentShader : WebGL.Shader {} Uniforms Varyings
fragmentShader =
    [glsl|

    precision mediump float;
    uniform vec3 cameraPos;
    uniform vec3 light1Pos;
    uniform vec3 light1Color;
    uniform vec3 light2Pos;
    uniform vec3 light2Color;
    uniform vec3 ambientColor;
    uniform vec3 diffuseColor;
    uniform vec3 specularColor;
    uniform float ka;
    uniform float kd;
    uniform float ks;
    uniform float shininess;
    varying vec3 vcolor;
    varying vec3 vpos;
    varying vec3 vnormal;

    vec3 colorFromLight (vec3 lightPos, vec3 lightColor) {
        vec3 normVec = normalize(vnormal);
        vec3 lightVec = normalize(lightPos - vpos);

        float diffuse = max(dot(normVec, lightVec), 0.0);

        float specular = 0.0;

        if(diffuse > 0.0) {
          vec3 reflectVec = reflect(-lightVec, normVec);
          vec3 camVec = normalize(cameraPos - vpos);
          float t = max(dot(reflectVec, camVec), 0.0);
          specular = pow(t, shininess);
        }

        vec3 cd = kd * diffuse * diffuseColor * vcolor;
        vec3 cs = ks * specular * specularColor;
        vec3 ca = ka * ambientColor;

        return ca + lightColor * (cd + cs);
    }

    void main () {
        vec3 color = ka * ambientColor;
        color += colorFromLight(light1Pos, light1Color);
        color += colorFromLight(light2Pos, light2Color);

        gl_FragColor = vec4(color, 1.0);
    }

    |]
