port module ElmMenu exposing (main)

import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onClick, onMouseEnter, onMouseLeave)


main =
    Html.programWithFlags
        { init = init
        , update = update
        , view = view
        , subscriptions = \_ -> Sub.none
        }



-- MODEL


type alias Classes =
    { menu : String
    , item : String
    , highlight : String
    }


type alias Flags =
    { classes : Classes
    , items : List String
    }


type alias Model =
    { classes : Classes
    , items : List String
    , highlighted : Maybe Int
    }


init : Flags -> ( Model, Cmd Msg )
init flags =
    { classes = flags.classes
    , items = flags.items
    , highlighted = Nothing
    }
        ! []



-- UPDATE


port send : Int -> Cmd msg


type Msg
    = Highlight (Maybe Int)
    | Select Int


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        Highlight i ->
            { model | highlighted = i } ! []

        Select i ->
            ( model, send i )



-- VIEW


view : Model -> Html Msg
view model =
    ul
        [ class model.classes.menu ]
        (List.indexedMap (viewItem model) model.items)


viewItem : Model -> Int -> String -> Html Msg
viewItem model i s =
    li
        [ classList
            [ ( model.classes.item, True )
            , ( model.classes.highlight, model.highlighted == Just i )
            ]
        , onMouseEnter <| Highlight (Just i)
        , onMouseLeave <| Highlight Nothing
        , onClick (Select i)
        ]
        [ text s ]
