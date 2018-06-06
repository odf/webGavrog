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


type alias Flags =
    { menuClass : String
    , itemClass : String
    , highlightClass : String
    , items : List String
    }


type alias Model =
    { menuClass : String
    , itemClass : String
    , highlightClass : String
    , items : List String
    , highlighted : Maybe Int
    }


init : Flags -> ( Model, Cmd Msg )
init flags =
    { menuClass = flags.menuClass
    , itemClass = flags.itemClass
    , highlightClass = flags.highlightClass
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
        [ class model.menuClass ]
        (List.indexedMap (viewItem model) model.items)


viewItem : Model -> Int -> String -> Html Msg
viewItem model i s =
    li
        [ classList
            [ ( model.itemClass, True )
            , ( model.highlightClass, model.highlighted == Just i )
            ]
        , onMouseEnter <| Highlight (Just i)
        , onMouseLeave <| Highlight Nothing
        , onClick (Select i)
        ]
        [ text s ]
